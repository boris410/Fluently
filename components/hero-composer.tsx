"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const LINES = [
  "Can I get a large oat latte, please?",
  "Excuse me, how do I get to the station?",
  "Tell me about a challenge you overcame.",
  "I've had a sore throat since Tuesday.",
];

/**
 * The centrepiece of the landing page: a composer that types on its own.
 * It is a decoy — clicking anywhere in it starts the real flow.
 */
export function HeroComposer() {
  const router = useRouter();
  const [line, setLine] = useState(0);
  const [chars, setChars] = useState(0);

  useEffect(() => {
    const full = LINES[line].length;
    if (chars < full) {
      const t = setTimeout(() => setChars((c) => c + 1), 42);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setChars(0);
      setLine((l) => (l + 1) % LINES.length);
    }, 2200);
    return () => clearTimeout(t);
  }, [chars, line]);

  const go = () => router.push("/scenarios");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      }}
      className="group w-full cursor-text rounded-[20px] border border-line bg-surface p-4 text-left shadow-[var(--shadow)] transition-all duration-300 hover:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 sm:p-5"
      aria-label="開始一段英文口說練習"
    >
      <p className="min-h-[3.25rem] px-1 text-[17px] leading-8 text-ink-soft sm:min-h-[2rem]">
        {LINES[line].slice(0, chars)}
        <span className="caret ml-0.5 inline-block h-[1.15em] w-[2px] translate-y-[3px] bg-clay" />
      </p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] text-ink-muted">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-clay" />
            Gemini
          </span>
          <span className="hidden items-center gap-1.5 rounded-full border border-line px-2.5 py-1.5 sm:inline-flex">
            🎙 語音輸入
          </span>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-clay text-on-clay transition-transform duration-300 group-hover:scale-105">
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
        </span>
      </div>
    </div>
  );
}
