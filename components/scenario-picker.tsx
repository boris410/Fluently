"use client";

import { useState } from "react";
import Link from "next/link";
import { LEVELS, type Level, type Scenario } from "@/lib/scenarios";

type Filter = Level | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "全部" },
  ...LEVELS.map((l) => ({ id: l.id as Filter, label: l.label })),
];

export function ScenarioPicker({ scenarios }: { scenarios: Scenario[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown =
    filter === "all" ? scenarios : scenarios.filter((s) => s.level === filter);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const active = f.id === filter;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={active}
              className={`rounded-full border px-4 py-2 text-[14px] transition-colors ${
                active
                  ? "border-clay bg-clay text-on-clay"
                  : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          );
        })}
        <span className="ml-auto text-[13px] text-ink-muted">
          {shown.length} 個情境
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((s, i) => (
          <ScenarioCard key={s.id} scenario={s} index={i} />
        ))}
      </div>
    </>
  );
}

function ScenarioCard({
  scenario,
  index,
}: {
  scenario: Scenario;
  index: number;
}) {
  const level = LEVELS.find((l) => l.id === scenario.level)!;

  return (
    <Link
      href={`/chat/${scenario.id}`}
      style={
        {
          animationDelay: `${index * 45}ms`,
          "--tint-light": scenario.tint[0],
          "--tint-dark": scenario.tint[1],
        } as React.CSSProperties
      }
      className="rise group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow)]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="tinted flex h-11 w-11 items-center justify-center rounded-xl text-[22px]">
          {scenario.emoji}
        </span>
        <span className="rounded-full border border-line px-2.5 py-1 text-[12px] text-ink-muted">
          {level.label}
        </span>
      </div>

      <h3 className="mt-4 font-display text-[19px] leading-snug tracking-tight">
        {scenario.title}
      </h3>
      <p className="mt-0.5 text-[13px] text-ink-muted">{scenario.titleZh}</p>
      <p className="mt-3 text-[14px] leading-6 text-ink-soft">
        {scenario.blurb}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {scenario.focus.map((f) => (
          <span
            key={f}
            className="rounded-md bg-surface-2 px-2 py-1 text-[12px] text-ink-muted"
          >
            {f}
          </span>
        ))}
      </div>

      <span className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-medium text-clay">
        開始對話
        <span className="transition-transform duration-300 group-hover:translate-x-1">
          →
        </span>
      </span>
    </Link>
  );
}
