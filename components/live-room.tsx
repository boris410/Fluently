"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SceneStage } from "@/components/scene-stage";
import type { Scenario } from "@/lib/scenarios";
import type { ScenePhase } from "@/lib/scene-clips";
import { canListen, listen, stopSpeaking } from "@/lib/speech";
import {
  type ChatTurn,
  type Stats,
  useConversation,
} from "@/lib/use-conversation";

/**
 * Immersive mode: no transcript, no buttons to press. The tutor speaks, the
 * mic opens by itself, and pausing sends the turn — the way a real
 * conversation goes. The transcript view is `ChatRoom`.
 */

/** Stop retrying after this many turns where nothing was heard. */
const SILENT_LIMIT = 3;

const PHASE_LABEL: Record<ScenePhase, string> = {
  warming: "歡迎光臨…",
  speaking: "家教說話中…",
  thinking: "思考中…",
  listening: "換你說…",
  paused: "已暫停",
  stalled: "沒聽到聲音",
};

export function LiveRoom({
  scenario,
  initialTurns,
  initialSessionId,
  initialStats,
}: {
  scenario: Scenario;
  initialTurns: ChatTurn[];
  initialSessionId: string | null;
  initialStats: Stats;
}) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const [listening, setListening] = useState(false);
  const [stalled, setStalled] = useState(false);

  const stopListenRef = useRef<(() => void) | null>(null);
  const pausedRef = useRef(false);
  const silentTries = useRef(0);
  /** Whether the current dictation turn produced any final text. */
  const heardRef = useRef(false);

  const startListeningRef = useRef<() => void>(() => {});

  const conversation = useConversation({
    scenario,
    initialTurns,
    initialSessionId,
    initialStats,
    mode: "live",
    forceSpeak: true,
    // The tutor finished a line on its own — hand the floor over.
    onSpeechFinished: () => startListeningRef.current(),
  });

  const {
    turns,
    sessionId,
    stats,
    pending,
    error,
    setError,
    hasKey,
    speakState,
    voiceNotice,
    needsGesture,
    send,
    replayLast,
  } = conversation;

  const stopListening = useCallback(() => {
    stopListenRef.current?.();
    stopListenRef.current = null;
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    // Never open the mic while the tutor is audible: it would record the
    // tutor's own voice and answer itself.
    if (pausedRef.current || stopListenRef.current) return;

    heardRef.current = false;
    const stop = listen({
      onStart: () => {
        setListening(true);
        setStalled(false);
      },
      onText: (text, isFinal) => {
        if (!isFinal || !text) return;
        heardRef.current = true;
        silentTries.current = 0;
        stopListening();
        void send(text);
      },
      onError: (err) => {
        setListening(false);
        if (err === "no-speech" || err === "aborted") return;
        stopListenRef.current = null;
        if (err === "not-allowed") {
          setError("瀏覽器擋住了麥克風權限，真實情境模式需要它才能運作。");
        } else {
          setError(`語音辨識失敗：${err}`);
        }
        setPaused(true);
        pausedRef.current = true;
      },
      onEnd: () => {
        setListening(false);
        stopListenRef.current = null;
        if (heardRef.current || pausedRef.current) return;

        // Nothing was said. Reopen the mic, but give up after a few tries so
        // a muted microphone cannot spin forever.
        silentTries.current += 1;
        if (silentTries.current >= SILENT_LIMIT) {
          setStalled(true);
          return;
        }
        window.setTimeout(() => startListeningRef.current(), 400);
      },
    });

    if (!stop) {
      setListening(false);
      return;
    }
    stopListenRef.current = stop;
  }, [send, setError, stopListening]);

  // Indirection through a ref keeps the loop callable from timers and from
  // the conversation hook without recreating either of them every render.
  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  useEffect(
    () => () => {
      stopListenRef.current?.();
      stopSpeaking();
    },
    [],
  );

  const togglePause = useCallback(() => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    if (next) {
      stopListening();
      stopSpeaking();
    } else {
      silentTries.current = 0;
      setStalled(false);
      startListeningRef.current();
    }
  }, [stopListening]);

  const retry = useCallback(() => {
    silentTries.current = 0;
    setStalled(false);
    startListeningRef.current();
  }, []);

  const finish = useCallback(() => {
    pausedRef.current = true;
    stopListening();
    stopSpeaking();
    router.push(
      sessionId
        ? `/chat/${scenario.id}?session=${sessionId}&mode=script`
        : "/scenarios",
    );
  }, [router, scenario.id, sessionId, stopListening]);

  // Opening line is the "customer just walked in" beat — keep the waving
  // still on screen while she greets, instead of swapping to the talking pose.
  const greeting = turns.length === 1 && turns[0]?.role === "model";

  const phase: ScenePhase = paused
    ? "paused"
    : pending
      ? "thinking"
      : speakState !== "idle"
        ? greeting
          ? "warming"
          : "speaking"
        : listening
          ? "listening"
          : stalled
            ? "stalled"
            : "warming";

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-8">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="w-full max-w-[340px]">
          <SceneStage scenario={scenario} phase={phase} />
        </div>

        <p className="mt-7 flex items-center gap-2 text-[17px] text-ink">
          <span
            aria-hidden
            className={`h-2 w-2 rounded-full ${
              phase === "listening"
                ? "bg-clay ripple"
                : phase === "speaking"
                  ? "bg-clay"
                  : "bg-line-strong"
            }`}
          />
          {PHASE_LABEL[phase]}
        </p>
        <p className="mt-2 text-[13px] text-ink-muted">
          {scenario.titleZh} · 來回 {stats.calls}
        </p>

        {!hasKey && (
          <div className="mt-8 w-full rounded-xl border border-clay/40 bg-clay-wash px-4 py-3 text-left text-[14px] leading-6">
            還沒設定 Gemini API key。點右上角
            <span className="mx-1 font-medium">設定</span>
            貼上你的 key 就可以開始。
          </div>
        )}

        {needsGesture && (
          <button
            type="button"
            onClick={replayLast}
            className="mt-8 w-full rounded-xl border border-clay/40 bg-clay-wash px-4 py-3 text-[14px] text-ink transition-opacity hover:opacity-90"
          >
            🔊 點一下開啟聲音
          </button>
        )}

        {stalled && (
          <button
            type="button"
            onClick={retry}
            className="mt-8 w-full rounded-xl border border-line-strong bg-surface px-4 py-3 text-[14px] text-ink transition-colors hover:border-clay hover:text-clay"
          >
            沒聽到聲音，點一下再試
          </button>
        )}

        {!canListen() && (
          <p className="mt-8 text-[13px] leading-6 text-ink-muted">
            這個瀏覽器不支援語音輸入，真實情境模式無法運作。
            <Link
              href={`/chat/${scenario.id}?mode=script`}
              className="ml-1 text-clay underline underline-offset-2"
            >
              改用獨白式對話
            </Link>
          </p>
        )}

        {voiceNotice && (
          <p className="mt-6 text-[12px] leading-5 text-ink-muted">
            {voiceNotice}
          </p>
        )}

        {error && (
          <div className="mt-6 w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-left text-[13px] leading-6 text-ink-soft">
            {error}
          </div>
        )}

        <div className="mt-10 flex items-center gap-3">
          <button
            type="button"
            onClick={togglePause}
            className="rounded-full border border-line-strong px-5 py-2.5 text-[14px] text-ink transition-colors hover:border-clay hover:text-clay"
          >
            {paused ? "繼續" : "暫停"}
          </button>
          <button
            type="button"
            onClick={finish}
            className="rounded-full bg-clay px-5 py-2.5 text-[14px] font-medium text-on-clay transition-opacity hover:opacity-90"
          >
            結束對話
          </button>
        </div>

        <p className="mt-6 text-[12px] leading-5 text-ink-muted">
          結束後可以回頭看剛才實際講了什麼。
        </p>
      </div>
    </div>
  );
}
