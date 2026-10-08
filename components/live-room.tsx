"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SceneStage } from "@/components/scene-stage";
import { TalkMic } from "@/components/talk-mic";
import type { Scenario } from "@/lib/scenarios";
import type { ScenePhase } from "@/lib/scene-clips";
import { stopSpeaking } from "@/lib/speech";
import { useHoldMic } from "@/lib/use-hold-mic";
import {
  type ChatTurn,
  type ConversationReview,
  type Stats,
  useConversation,
} from "@/lib/use-conversation";

/**
 * Immersive mode: no transcript. The tutor speaks, then the learner taps
 * the mic to talk and taps again to send — pauses do not send.
 */

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
  initialReview = null,
}: {
  scenario: Scenario;
  initialTurns: ChatTurn[];
  initialSessionId: string | null;
  initialStats: Stats;
  initialReview?: ConversationReview | null;
}) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const closeMicRef = useRef<() => void>(() => {});

  const conversation = useConversation({
    scenario,
    initialTurns,
    initialSessionId,
    initialStats,
    initialReview,
    mode: "live",
    forceSpeak: true,
    onReviewBegin: () => {
      setPaused(true);
      closeMicRef.current();
    },
    onReviewReady: (id) => {
      router.push(`/chat/${scenario.id}?session=${id}&mode=script`);
    },
  });

  const {
    turns,
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
    reviewPending,
    stopPlayback,
    endConversation,
  } = conversation;

  const tutorBusy = pending || speakState !== "idle";
  const { listening, voicing, level, toggle, close, supported } = useHoldMic({
    busy: tutorBusy,
    onSend: (text) => void send(text),
    setError,
  });

  useEffect(() => {
    closeMicRef.current = close;
  }, [close]);

  // Never keep the mic open while the tutor is audible or thinking: it
  // would record the tutor's own voice and answer itself.
  useEffect(() => {
    if (tutorBusy) close();
  }, [tutorBusy, close]);

  useEffect(
    () => () => {
      close();
      stopSpeaking();
    },
    [close],
  );

  const togglePause = useCallback(() => {
    setPaused((current) => {
      const next = !current;
      if (next) {
        close();
        stopPlayback();
      }
      return next;
    });
  }, [close, stopPlayback]);

  const finish = useCallback(async () => {
    setPaused(true);
    close();
    await endConversation();
  }, [close, endConversation]);

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
        : "listening";

  const micLocked = paused || (tutorBusy && !listening) || !supported;

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
            還沒設定 Gemini API key。到<Link href="/backend" className="font-medium text-clay underline underline-offset-2">後台</Link>貼上你的 key 就可以開始。
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

        {supported ? (
          <div className="mt-8 flex flex-col items-center gap-3">
            <TalkMic
              listening={listening}
              voicing={voicing}
              level={level}
              disabled={micLocked}
              onToggle={toggle}
            />
            <p className="text-[12px] leading-5 text-ink-muted">
              按一下開始說，再說一次送出 · 最長 30 秒
            </p>
          </div>
        ) : (
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
            onClick={() => void finish()}
            disabled={reviewPending}
            className="rounded-full bg-clay px-5 py-2.5 text-[14px] font-medium text-on-clay transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            結束對話
          </button>
        </div>

        <p className="mt-6 text-[12px] leading-5 text-ink-muted">
          結束後會給你建議、單字、文法與句子的回饋。
        </p>
        {reviewPending && (
          <p className="mt-3 text-[14px] leading-6 text-ink-soft">
            正在整理這次練習的回饋…
          </p>
        )}
      </div>
    </div>
  );
}
