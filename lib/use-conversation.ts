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
  getVoiceSource,
  subscribeSettings,
} from "@/lib/settings";
import { parseSessionReview, type SessionReview } from "@/lib/gemini";
import type { Scenario } from "@/lib/scenarios";
import {
  type SpeakState,
  canSpeak,
  speakReply,
  stopSpeaking,
} from "@/lib/speech";

/**
 * Everything a conversation needs, minus the presentation: sending turns,
 * playing the tutor's voice, and the token tally. Both the transcript view
 * (`ChatRoom`) and the immersive view (`LiveRoom`) are built on this.
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

export type ReviewOutcome = "completed" | "incomplete" | "manual";
export type WrapUpOutcome = "completed" | "incomplete";

/** Canonical review JSON plus the UI-only outcome from API / RSC. */
export type ConversationReview = SessionReview & {
  outcome: ReviewOutcome;
};

export function parseReviewOutcome(value: unknown): ReviewOutcome {
  if (value === "completed" || value === "incomplete" || value === "manual") {
    return value;
  }
  return "manual";
}

/** Wrap-up only when `wrapUp` is an object with a valid completed/incomplete outcome. */
export function parseWrapUp(
  value: unknown,
): { outcome: WrapUpOutcome } | null {
  if (!value || typeof value !== "object") return null;
  const outcome = (value as { outcome?: unknown }).outcome;
  if (outcome === "completed" || outcome === "incomplete") {
    return { outcome };
  }
  return null;
}

export function useConversation({
  scenario,
  initialTurns,
  initialSessionId,
  initialStats,
  initialReview = null,
  mode,
  forceSpeak = false,
  onSpeechFinished,
  onReviewBegin,
  onReviewReady,
}: {
  scenario: Scenario;
  initialTurns: ChatTurn[];
  initialSessionId: string | null;
  initialStats: Stats;
  initialReview?: ConversationReview | null;
  mode?: "script" | "live";
  /**
   * Speak regardless of the "auto read replies" preference. Live mode
   * sets this: a silent live conversation has nothing left to work with.
   */
  forceSpeak?: boolean;
  /**
   * Fires when a tutor line finishes playing on its own. Not called when
   * playback was stopped.
   */
  onSpeechFinished?: () => void;
  /** Live: pause and close the mic when a review POST is claimed. */
  onReviewBegin?: () => void;
  /** Live: redirect to the script transcript after a successful review. */
  onReviewReady?: (sessionId: string, review: ConversationReview) => void;
}) {
  const [turns, setTurns] = useState<ChatTurn[]>(initialTurns);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [review, setReview] = useState<ConversationReview | null>(initialReview);
  const [reviewPending, setReviewPending] = useState(false);
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
  const turnsRef = useRef(initialTurns);
  const reviewRef = useRef(initialReview);
  const reviewClaimedRef = useRef(false);
  const reviewPendingRef = useRef(false);
  const pendingWrapUpOutcomeRef = useRef<WrapUpOutcome | null>(null);
  const autoReviewWaitRef = useRef<{
    turnId: string;
    sessionId: string;
  } | null>(null);
  const playbackStartedIdRef = useRef<string | null>(null);
  const openingSessionRef = useRef<{
    promise: Promise<string | null>;
    resolve: (id: string | null) => void;
    settled: boolean;
  } | null>(null);
  // Kept in a ref so `play` stays stable even when the callback changes.
  // Synced in an effect because refs must not be written during render.
  const finishedRef = useRef(onSpeechFinished);
  const onReviewBeginRef = useRef(onReviewBegin);
  const onReviewReadyRef = useRef(onReviewReady);
  const fireEndedReviewRef = useRef<(id: string) => void>(() => {});
  const scheduleEndedReviewRef = useRef<
    (turn: ChatTurn, id: string | null) => void
  >(() => {});
  useEffect(() => {
    finishedRef.current = onSpeechFinished;
    onReviewBeginRef.current = onReviewBegin;
    onReviewReadyRef.current = onReviewReady;
  }, [onReviewBegin, onReviewReady, onSpeechFinished]);

  useEffect(
    () => () => {
      autoReviewWaitRef.current = null;
      stopSpeaking();
    },
    [],
  );

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
      playbackStartedIdRef.current = null;
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
            if (state === "playing") playbackStartedIdRef.current = turn.id;
          } else {
            const waiting = autoReviewWaitRef.current;
            if (
              waiting &&
              waiting.turnId === turn.id &&
              playbackStartedIdRef.current === turn.id
            ) {
              fireEndedReviewRef.current(waiting.sessionId);
            }
            finishedRef.current?.();
          }
        },
        onFallback: (reason) =>
          setVoiceNotice(`角色語音沒出來，已改用瀏覽器語音。（${reason}）`),
        onBlocked: () => {
          setNeedsGesture(true);
          const waiting = autoReviewWaitRef.current;
          if (waiting && waiting.turnId === turn.id) {
            fireEndedReviewRef.current(waiting.sessionId);
          }
        },
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
    const waiting = autoReviewWaitRef.current;
    stopSpeaking();
    setSpeakingId(null);
    setSpeakState("idle");
    if (waiting) fireEndedReviewRef.current(waiting.sessionId);
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
      setTurns((prev) => {
        const next = [
          ...prev,
          { id: crypto.randomUUID(), role: "user" as const, text: trimmed },
        ];
        turnsRef.current = next;
        return next;
      });
      setPending(true);

      try {
        let id = sessionIdRef.current;
        if (!id && openingSessionRef.current) {
          id = await openingSessionRef.current.promise;
        }
        // Cancel the previous wrap-up wait before stopSpeaking so a
        // browser-voice onend does not POST review and then send.
        autoReviewWaitRef.current = null;
        pendingWrapUpOutcomeRef.current = null;
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
        setTurns((prev) => {
          const next = [...prev, replyTurn];
          turnsRef.current = next;
          return next;
        });
        setStats((prev) => ({
          calls: prev.calls + 1,
          promptTokens: prev.promptTokens + (data.usage?.promptTokens ?? 0),
          outputTokens: prev.outputTokens + (data.usage?.outputTokens ?? 0),
          totalTokens: prev.totalTokens + (data.usage?.totalTokens ?? 0),
        }));

        const booked = typeof data.sessionId === "string" ? data.sessionId : null;
        const wrapUp = parseWrapUp(data.wrapUp);
        if (wrapUp && replyTurn.text) {
          pendingWrapUpOutcomeRef.current = wrapUp.outcome;
          scheduleEndedReviewRef.current(
            replyTurn,
            booked ?? sessionIdRef.current,
          );
        } else {
          pendingWrapUpOutcomeRef.current = null;
          if (forceSpeak || getAutoSpeak()) {
            play(replyTurn, booked);
          }
        }
      } catch {
        setError("連線失敗，請確認 dev server 還在跑。");
      } finally {
        setPending(false);
      }
    },
    [forceSpeak, mode, pending, play, rememberSession, scenario.id],
  );

  const requestReview = useCallback(
    async (id: string, outcome: ReviewOutcome) => {
      setError(null);
      reviewPendingRef.current = true;
      setReviewPending(true);
      try {
        const res = await fetch("/api/review", {
          method: "POST",
          headers: apiHeaders(),
          body: JSON.stringify({ sessionId: id, outcome }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? `發生錯誤（${res.status}）`);
          if (res.status === 401) setRejectedKey(true);
          return null;
        }

        setRejectedKey(false);
        const next = parseSessionReview(data.review);
        if (!next) {
          setError("回饋沒有產生，請再試一次。");
          return null;
        }
        const withOutcome: ConversationReview = {
          ...next,
          outcome: parseReviewOutcome(data.outcome),
        };
        reviewRef.current = withOutcome;
        setReview(withOutcome);
        return withOutcome;
      } catch {
        setError("連線失敗，請確認 dev server 還在跑。");
        return null;
      } finally {
        reviewPendingRef.current = false;
        setReviewPending(false);
      }
    },
    [],
  );

  const resolveReviewOutcome = useCallback((): ReviewOutcome => {
    return pendingWrapUpOutcomeRef.current ?? "manual";
  }, []);

  const claimAndRequestReview = useCallback(
    async (id: string, outcome: ReviewOutcome) => {
      if (reviewRef.current) {
        onReviewBeginRef.current?.();
        onReviewReadyRef.current?.(id, reviewRef.current);
        return reviewRef.current;
      }
      if (reviewClaimedRef.current) return null;
      reviewClaimedRef.current = true;
      onReviewBeginRef.current?.();
      const result = await requestReview(id, outcome);
      if (result) {
        onReviewReadyRef.current?.(id, result);
      } else {
        reviewClaimedRef.current = false;
      }
      return result;
    },
    [requestReview],
  );

  const fireEndedReview = useCallback(
    (id: string) => {
      autoReviewWaitRef.current = null;
      if (!id) return;
      if (!turnsRef.current.some((t) => t.role === "user")) {
        setError("至少說一句再結束，才有辦法給回饋。");
        return;
      }
      void claimAndRequestReview(id, resolveReviewOutcome());
    },
    [claimAndRequestReview, resolveReviewOutcome],
  );

  const scheduleEndedReview = useCallback(
    (turn: ChatTurn, id: string | null) => {
      if (!id) return;
      if (
        reviewClaimedRef.current &&
        !reviewPendingRef.current &&
        !reviewRef.current
      ) {
        reviewClaimedRef.current = false;
      }
      if (reviewClaimedRef.current && reviewPendingRef.current) {
        if (forceSpeak || getAutoSpeak()) play(turn, id);
        return;
      }
      if (!turnsRef.current.some((t) => t.role === "user")) {
        setError("至少說一句再結束，才有辦法給回饋。");
        return;
      }

      const wantSpeak = forceSpeak || getAutoSpeak();
      const canAttempt =
        wantSpeak && !(getVoiceSource() === "browser" && !canSpeak());
      if (!canAttempt) {
        fireEndedReview(id);
        return;
      }

      autoReviewWaitRef.current = { turnId: turn.id, sessionId: id };
      void play(turn, id);
    },
    [fireEndedReview, forceSpeak, play],
  );

  useEffect(() => {
    fireEndedReviewRef.current = fireEndedReview;
    scheduleEndedReviewRef.current = scheduleEndedReview;
  }, [fireEndedReview, scheduleEndedReview]);

  const endConversation = useCallback(async () => {
    autoReviewWaitRef.current = null;
    stopSpeaking();
    setSpeakingId(null);
    setSpeakState("idle");

    const id = sessionIdRef.current;
    if (!id || !turnsRef.current.some((t) => t.role === "user")) {
      setError("至少說一句再結束，才有辦法給回饋。");
      return null;
    }
    return claimAndRequestReview(id, resolveReviewOutcome());
  }, [claimAndRequestReview, resolveReviewOutcome]);

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
    review,
    reviewPending,
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
    endConversation,
  };
}
