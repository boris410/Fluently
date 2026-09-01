"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mark } from "@/components/logo";
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
}: {
  scenario: Scenario;
  initialTurns: ChatTurn[];
  initialSessionId: string | null;
  initialStats: Stats;
}) {
  const {
    turns,
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
  } = useConversation({
    scenario,
    initialTurns,
    initialSessionId,
    initialStats,
    mode: "script",
  });

  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const stopListenRef = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, pending]);

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
