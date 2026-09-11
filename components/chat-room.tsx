"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Mark } from "@/components/logo";
import type { SessionReview } from "@/lib/gemini";
import type { Scenario } from "@/lib/scenarios";
import { type SpeakState, canListen, canSpeak, listen } from "@/lib/speech";
import {
  type ChatTurn,
  type Stats,
  useConversation,
} from "@/lib/use-conversation";

export type { ChatTurn } from "@/lib/use-conversation";

/**
 * Transcript mode: every line is shown, the learner taps the mic to speak or
 * types instead. The immersive counterpart is `LiveRoom`.
 */
export function ChatRoom({
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
  initialReview?: SessionReview | null;
}) {
  const {
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
    requestReview,
  } = useConversation({
    scenario,
    initialTurns,
    initialSessionId,
    initialStats,
    initialReview,
    mode: "script",
  });

  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const stopListenRef = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, pending, review, reviewPending]);

  const submit = useCallback(
    async (text: string) => {
      if (!text.trim() || pending) return;
      stopListenRef.current?.();
      setListening(false);
      setDraft("");
      await send(text);
      inputRef.current?.focus();
    },
    [pending, send],
  );

  const toggleMic = useCallback(() => {
    if (listening) {
      stopListenRef.current?.();
      stopListenRef.current = null;
      setListening(false);
      return;
    }
    stopPlayback();
    const stop = listen({
      onText: (text, isFinal) => {
        setDraft(text);
        if (isFinal && text) void submit(text);
      },
      onError: (err) => {
        setError(
          err === "not-allowed"
            ? "瀏覽器擋住了麥克風權限。"
            : `語音辨識失敗：${err}`,
        );
        setListening(false);
      },
      onEnd: () => setListening(false),
    });
    if (!stop) {
      setError("這個瀏覽器不支援語音輸入，改用打字吧。");
      return;
    }
    stopListenRef.current = stop;
    setListening(true);
  }, [listening, setError, stopPlayback, submit]);

  const endConversation = useCallback(async () => {
    if (!sessionId || !turns.some((t) => t.role === "user")) {
      setError("至少說一句再結束，才有辦法給回饋。");
      return;
    }
    await requestReview(sessionId);
  }, [requestReview, sessionId, setError, turns]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-8 sm:px-8">
        <p className="text-center text-[13px] text-ink-muted">
          {scenario.blurb}
        </p>

        <div className="mt-8 flex-1 space-y-5">
          {turns.map((turn) =>
            turn.role === "model" ? (
              <TutorTurn
                key={turn.id}
                turn={turn}
                state={speakingId === turn.id ? speakState : "idle"}
                onPlay={() => play(turn)}
                onStop={stopPlayback}
              />
            ) : (
              <LearnerTurn key={turn.id} turn={turn} />
            ),
          )}
          {pending && <Thinking />}
          {reviewPending && (
            <p className="text-[14px] leading-7 text-ink-soft">
              正在整理這次練習的回饋…
            </p>
          )}
          {review && <PracticeReview review={review} />}
          <div ref={bottomRef} />
        </div>

        {!hasKey && (
          <div className="mt-6 rounded-xl border border-clay/40 bg-clay-wash px-4 py-3 text-[14px] leading-6">
            還沒設定 Gemini API key。點右上角
            <span className="mx-1 font-medium">設定</span>
            貼上你的 key 就可以開始對話。
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 font-medium text-clay underline underline-offset-2"
            >
              去申請一組
            </a>
          </div>
        )}

        {needsGesture && (
          <button
            type="button"
            onClick={replayLast}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-clay/40 bg-clay-wash px-4 py-3 text-[14px] text-ink transition-opacity hover:opacity-90"
          >
            🔊 點一下開啟聲音
            <span className="text-[12px] text-ink-muted">
              瀏覽器要求先有一次互動才能播放
            </span>
          </button>
        )}

        {voiceNotice && (
          <div className="mt-4 rounded-xl border border-line bg-surface-2 px-4 py-3 text-[13px] leading-6 text-ink-muted">
            {voiceNotice}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-line bg-surface-2 px-4 py-3 text-[14px] leading-6 text-ink-soft">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => void endConversation()}
            disabled={reviewPending}
            className="rounded-full border border-line-strong px-4 py-2 font-medium text-ink transition-colors hover:border-clay hover:text-clay disabled:opacity-40"
          >
            結束對話
          </button>
        </div>

        <div className="sticky bottom-4 mt-6">
          <div className="rounded-[20px] border border-line bg-surface p-3 shadow-[var(--shadow)] sm:p-4">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit(draft);
                }
              }}
              rows={2}
              placeholder={
                listening ? "聽你說…" : "說點什麼，或按麥克風開口說 (Enter 送出)"
              }
              className="w-full resize-none bg-transparent px-1 text-[16px] leading-7 text-ink placeholder:text-ink-muted focus:outline-none"
            />

            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[12px] text-ink-muted">
                <span className="rounded-full border border-line px-2.5 py-1">
                  來回 {stats.calls}
                </span>
                <span className="rounded-full border border-line px-2.5 py-1">
                  {stats.totalTokens.toLocaleString()} tokens
                </span>
                <Link
                  href="/usage"
                  className="hidden transition-colors hover:text-ink sm:inline"
                >
                  用量 →
                </Link>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={!canListen() || pending}
                  aria-pressed={listening}
                  aria-label="語音輸入"
                  title={canListen() ? "語音輸入" : "此瀏覽器不支援語音輸入"}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors disabled:opacity-40 ${
                    listening
                      ? "border-clay bg-clay text-on-clay"
                      : "border-line text-ink-soft hover:border-line-strong hover:text-ink"
                  }`}
                >
                  <MicIcon />
                </button>
                <button
                  type="button"
                  onClick={() => void submit(draft)}
                  disabled={pending || !draft.trim()}
                  aria-label="送出"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-clay text-on-clay transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <SendIcon />
                </button>
              </div>
            </div>
          </div>

          {!canSpeak() && (
            <p className="mt-2 text-center text-[12px] text-ink-muted">
              此瀏覽器不支援朗讀，家教的回覆只會以文字顯示。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PracticeReview({ review }: { review: SessionReview }) {
  return (
    <div className="rise rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-display text-[28px] sm:text-[32px]">這次練習的回饋</h2>
      <p className="mt-2 text-[14px] leading-7 text-ink-soft">
        根據你剛才說的內容整理。家教在對話裡不會出戲糾正；這份是另外產出的回顧。
      </p>

      <ReviewSection title="建議" empty={review.advice.length === 0}>
        {review.advice.map((item, i) => (
          <div key={`advice-${i}`}>
            <p className="text-[16px] leading-7">{item.headline}</p>
            <p className="text-[14px] leading-7 text-ink-soft">{item.detail}</p>
          </div>
        ))}
      </ReviewSection>

      <ReviewSection title="單字" empty={review.vocabulary.length === 0}>
        {review.vocabulary.map((item, i) => (
          <div key={`vocab-${i}`}>
            <p className="text-[16px] leading-7">{item.word}</p>
            <p className="text-[14px] leading-7 text-ink-soft">{item.meaningZh}</p>
            <p className="text-[16px] leading-7">{item.exampleEn}</p>
            <p className="text-[14px] leading-7 text-ink-soft">{item.noteZh}</p>
          </div>
        ))}
      </ReviewSection>

      <ReviewSection title="文法" empty={review.grammar.length === 0}>
        {review.grammar.map((item, i) => (
          <div key={`grammar-${i}`}>
            <p className="text-[14px] leading-7 text-ink-soft">{item.pointZh}</p>
            <p className="text-[14px] leading-7 text-ink-soft">{item.issueZh}</p>
            <p className="text-[16px] leading-7">{item.betterEn}</p>
          </div>
        ))}
      </ReviewSection>

      <ReviewSection title="句子" empty={review.sentences.length === 0}>
        {review.sentences.map((item, i) => (
          <div key={`sentence-${i}`}>
            <p className="text-[16px] leading-7">{item.originalEn}</p>
            <p className="text-[16px] leading-7">{item.betterEn}</p>
            <p className="text-[14px] leading-7 text-ink-soft">{item.whyZh}</p>
          </div>
        ))}
      </ReviewSection>

      <Link
        href="/scenarios"
        className="mt-8 inline-flex h-13 items-center gap-2 rounded-full bg-clay px-7 text-[16px] font-medium text-on-clay shadow-[var(--shadow)] transition-colors hover:bg-clay-deep"
      >
        再練一次
      </Link>
    </div>
  );
}

function ReviewSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: ReactNode;
}) {
  return (
    <section className="mt-8">
      <h3 className="font-display text-[18px] leading-snug sm:text-[19px]">
        {title}
      </h3>
      {empty ? (
        <p className="mt-2 text-[14px] leading-7 text-ink-soft">
          這次沒什麼需要特別標的。
        </p>
      ) : (
        <div className="mt-3 space-y-4">{children}</div>
      )}
    </section>
  );
}

function TutorTurn({
  turn,
  state,
  onPlay,
  onStop,
}: {
  turn: ChatTurn;
  state: SpeakState;
  onPlay: () => void;
  onStop: () => void;
}) {
  return (
    <div className="rise flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface">
        <Mark className="h-4 w-4 text-clay" />
      </span>
      <div className="min-w-0">
        <div className="rounded-2xl rounded-tl-sm border border-line bg-surface px-4 py-3 text-[16px] leading-7">
          {turn.text}
        </div>
        <div className="mt-1.5 flex items-center gap-3 px-1 text-[12px] text-ink-muted">
          {turn.usage && (
            <span className="font-mono">
              ↑{turn.usage.promptTokens} ↓{turn.usage.outputTokens}
            </span>
          )}
          {turn.latencyMs !== undefined && (
            <span className="font-mono">
              {(turn.latencyMs / 1000).toFixed(1)}s
            </span>
          )}
          <button
            type="button"
            onClick={state === "idle" ? onPlay : onStop}
            className={`transition-colors hover:text-ink ${
              state === "idle" ? "" : "text-clay"
            }`}
          >
            {state === "loading"
              ? "◌ 產生語音…"
              : state === "playing"
                ? "◼ 停止"
                : "🔊 唸給我聽"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LearnerTurn({ turn }: { turn: ChatTurn }) {
  return (
    <div className="rise flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-clay px-4 py-3 text-[16px] leading-7 text-on-clay">
        {turn.text}
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface">
        <Mark className="h-4 w-4 text-clay" />
      </span>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-line bg-surface px-4 py-4">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{ animationDelay: `${i * 160}ms` }}
            className="glow h-1.5 w-1.5 rounded-full bg-ink-muted"
          />
        ))}
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-[17px] w-[17px]" aria-hidden>
      <rect
        x="7.4"
        y="2.6"
        width="5.2"
        height="9"
        rx="2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M4.6 9.2a5.4 5.4 0 0 0 10.8 0M10 14.6v2.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      <path
        d="M10 16V4m0 0L4.8 9.2M10 4l5.2 5.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
