"use client";

import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import type { Scenario } from "@/lib/scenarios";
import { canListen } from "@/lib/speech";

/**
 * Shown once before a conversation starts. Besides picking a mode, this
 * click is what unlocks the microphone permission prompt and the browser's
 * autoplay policy — both need a real user gesture in the document.
 */
export function ModePicker({ scenario }: { scenario: Scenario }) {
  // Read the capability without an effect so the server render (assume
  // supported) never mismatches during hydration.
  const subscribe = useCallback(() => () => {}, []);
  const speechSupported = useSyncExternalStore(
    subscribe,
    () => canListen(),
    () => true,
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-12 sm:px-8">
      <p className="text-center text-[13px] text-ink-muted">{scenario.blurb}</p>
      <h1 className="rise mt-4 text-center font-display text-[30px] leading-tight tracking-tight sm:text-[36px]">
        今天想怎麼練？
      </h1>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Card
          href={`/chat/${scenario.id}?mode=script`}
          icon="📝"
          title="獨白式對話"
          body="看得到逐字稿，按麥克風說話，也可以打字。適合確認自己到底講對沒有。"
          points={["顯示每一句話", "按鈕控制發言", "可以打字"]}
          delay={0}
        />

        {speechSupported ? (
          <Card
            href={`/chat/${scenario.id}?mode=live`}
            icon="🎧"
            title="真實情境"
            body="沒有字幕、不用按按鈕。家教說完自動換你，停頓就送出——像真的在跟人講話。"
            points={["沒有字幕", "免持自動輪流", "需要麥克風權限"]}
            delay={60}
            accent
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-line-strong bg-surface-2 p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface text-[22px] opacity-50">
              🎧
            </span>
            <h2 className="mt-4 font-display text-[19px] tracking-tight text-ink-muted">
              真實情境
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-ink-muted">
              這個瀏覽器不支援語音辨識，免持模式無法運作。
              換用 Chrome 或 Safari 就能使用。
            </p>
          </div>
        )}
      </div>

      <p className="mt-8 text-center text-[12px] leading-5 text-ink-muted">
        兩種模式的對話都會存進同一個紀錄，隨時可以換。
      </p>
    </div>
  );
}

function Card({
  href,
  icon,
  title,
  body,
  points,
  delay,
  accent = false,
}: {
  href: string;
  icon: string;
  title: string;
  body: string;
  points: string[];
  delay: number;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{ animationDelay: `${delay}ms` }}
      className={`rise group flex flex-col rounded-2xl border bg-surface p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow)] ${
        accent
          ? "border-clay/40 hover:border-clay"
          : "border-line hover:border-line-strong"
      }`}
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-xl text-[22px] ${
          accent ? "bg-clay-wash" : "bg-surface-2"
        }`}
      >
        {icon}
      </span>
      <h2 className="mt-4 font-display text-[19px] tracking-tight">{title}</h2>
      <p className="mt-2 text-[14px] leading-6 text-ink-soft">{body}</p>

      <ul className="mt-4 flex flex-wrap gap-1.5">
        {points.map((p) => (
          <li
            key={p}
            className="rounded-md bg-surface-2 px-2 py-1 text-[12px] text-ink-muted"
          >
            {p}
          </li>
        ))}
      </ul>

      <span className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-medium text-clay">
        開始
        <span className="transition-transform duration-300 group-hover:translate-x-1">
          →
        </span>
      </span>
    </Link>
  );
}
