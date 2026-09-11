"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  apiHeaders,
  getApiKey,
  getAutoSpeak,
  subscribeSettings,
} from "@/lib/settings";
import type { Scenario } from "@/lib/scenarios";
import { type SpeakState, speakReply, stopSpeaking } from "@/lib/speech";

/**
 * Everything a conversation needs, minus the presentation: sending turns,
 * playing the tutor's voice, and the token tally. Both the transcript view
 * (`ChatRoom`) and the hands-free view (`LiveRoom`) are built on this.
 */

export type ChatTurn = {
  /** Stable across renders so playback state can point at one line. */
  id: string;
  role: "user" | "model";
  text: string;
  usage?: { promptTokens: number; outputTokens: number };
  latencyMs?: number;
};

export type Stats = {
  calls: number;
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export function useConversation({
  scenario,
  initialTurns,
  initialSessionId,
  initialStats,
  mode,
  forceSpeak = false,
  onSpeechFinished,
}: {
  scenario: Scenario;
  initialTurns: ChatTurn[];
  initialSessionId: string | null;
  initialStats: Stats;
  mode?: "script" | "live";
  /**
   * Speak regardless of the "auto read replies" preference. Hands-free mode
   * sets this: a silent live conversation has nothing left to work with.
   */
  forceSpeak?: boolean;
  /**
   * Fires when a tutor line finishes playing on its own. Hands-free mode
   * uses it to take the next turn. Not called when playback was stopped.
   */
  onSpeechFinished?: () => void;
}) {
  const [turns, setTurns] = useState<ChatTurn[]>(initialTurns);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectedKey, setRejectedKey] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [speakState, setSpeakState] = useState<SpeakState>("idle");
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [needsGesture, setNeedsGesture] = useState(false);

  // Reads localStorage without an effect, and updates the moment the key is
  // saved in the settings panel. The server snapshot hides the banner so it
  // never flashes before hydration.
  const storedKey = useSyncExternalStore(
    subscribeSettings,
    () => (getApiKey() ? "set" : "missing"),
    () => "set",
  );
  const [serverConfigured, setServerConfigured] = useState(true);
  useEffect(() => {
    let stale = false;
    fetch("/api/key-check")
      .then((res) => res.json())
      .then((data: { configured?: boolean }) => {
        if (!stale) setServerConfigured(Boolean(data.configured));
      })
      .catch(() => {
        if (!stale) setServerConfigured(false);
      });
    return () => {
      stale = true;
    };
  }, []);
  const hasKey =
    (storedKey === "set" || serverConfigured) && !rejectedKey;

  const greeted = useRef(false);
  const sessionIdRef = useRef(initialSessionId);
  const openingSessionRef = useRef<{
    promise: Promise<string | null>;
    resolve: (id: string | null) => void;
    settled: boolean;
  } | null>(null);
  // Kept in a ref so `play` stays stable even when the callback changes.
  // Synced in an effect because refs must not be written during render.
  const finishedRef = useRef(onSpeechFinished);
  useEffect(() => {
    finishedRef.current = onSpeechFinished;
  }, [onSpeechFinished]);

  useEffect(() => () => stopSpeaking(), []);

  const rememberSession = useCallback((id: string) => {
    if (!sessionIdRef.current) sessionIdRef.current = id;
    setSessionId((prev) => prev ?? id);
  }, []);

  const settleOpeningSession = useCallback((id: string | null) => {
    const opening = openingSessionRef.current;
    if (!opening || opening.settled) return;
    opening.settled = true;
    opening.resolve(id);
  }, []);

  /**
   * Speaks one tutor line. Every state change happens inside a callback, so
   * this is safe to call straight from an effect as well as a click.
   */
  const play = useCallback(
    (turn: ChatTurn, sessionOverride?: string | null) => {
      const booked = sessionOverride ?? sessionIdRef.current;
      return speakReply(turn.text, {
        scenarioId: scenario.id,
        sessionId: booked,
        mode,
        onState: (state) => {
          setSpeakState(state);
          setSpeakingId(state === "idle" ? null : turn.id);
          if (state !== "idle") {
            setNeedsGesture(false);
            setVoiceNotice(null);
          } else {
            finishedRef.current?.();
          }
        },
        onFallback: (reason) =>
          setVoiceNotice(`角色語音沒出來，已改用瀏覽器語音。（${reason}）`),
        onBlocked: () => setNeedsGesture(true),
        onSession: (id) => {
          rememberSession(id);
          settleOpeningSession(id);
        },
      }).then(
        (id) => {
          if (id) rememberSession(id);
          settleOpeningSession(id ?? sessionIdRef.current);
          return sessionIdRef.current;
        },
        () => {
          settleOpeningSession(sessionIdRef.current);
          return sessionIdRef.current;
        },
      );
    },
    [mode, rememberSession, scenario.id, settleOpeningSession],
  );

  const stopPlayback = useCallback(() => {
    stopSpeaking();
    setSpeakingId(null);
    setSpeakState("idle");
  }, []);

  // New rooms always greet out loud — that TTS call is what mints the
  // session. Resumed sessions stay quiet.
  useEffect(() => {
    if (greeted.current || initialSessionId) return;
    greeted.current = true;
    const opening = initialTurns[0];
    if (opening?.role !== "model") return;

    let resolve!: (id: string | null) => void;
    const promise = new Promise<string | null>((r) => {
      resolve = r;
    });
    openingSessionRef.current = { promise, resolve, settled: false };
    void play(opening);
  }, [initialSessionId, initialTurns, play]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending) return;

      setError(null);
      setTurns((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", text: trimmed },
      ]);
      setPending(true);

      try {
        let id = sessionIdRef.current;
        if (!id && openingSessionRef.current) {
          id = await openingSessionRef.current.promise;
        }
        stopSpeaking();

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: apiHeaders(),
          body: JSON.stringify({
            scenarioId: scenario.id,
            sessionId: id,
            mode,
            text: trimmed,
          }),
        });
        const data = await res.json();

        if (typeof data.sessionId === "string") rememberSession(data.sessionId);

        if (!res.ok) {
          setError(data.error ?? `發生錯誤（${res.status}）`);
          if (res.status === 401) setRejectedKey(true);
          return;
        }

        setRejectedKey(false);
        const replyTurn: ChatTurn = {
          id: crypto.randomUUID(),
          role: "model",
          text: data.reply,
          usage: data.usage,
          latencyMs: data.latencyMs,
        };
        setTurns((prev) => [...prev, replyTurn]);
        setStats((prev) => ({
          calls: prev.calls + 1,
          promptTokens: prev.promptTokens + (data.usage?.promptTokens ?? 0),
          outputTokens: prev.outputTokens + (data.usage?.outputTokens ?? 0),
          totalTokens: prev.totalTokens + (data.usage?.totalTokens ?? 0),
        }));
        if (forceSpeak || getAutoSpeak()) play(replyTurn, data.sessionId);
      } catch {
        setError("連線失敗，請確認 dev server 還在跑。");
      } finally {
        setPending(false);
      }
    },
    [forceSpeak, mode, pending, play, rememberSession, scenario.id],
  );

  /** Replays the most recent tutor line — used by the unlock prompt. */
  const replayLast = useCallback(() => {
    const last = [...turns].reverse().find((t) => t.role === "model");
    if (last) play(last);
  }, [play, turns]);

  return {
    turns,
    sessionId,
    stats,
    pending,
    error,
    setError,
    hasKey,
    speakingId,
    speakState,
    voiceNotice,
    needsGesture,
    send,
    play,
    stopPlayback,
    replayLast,
  };
}
