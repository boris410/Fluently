import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/current-user";
import { getAgentRun, type AgentTurnRow } from "@/lib/db";
import {
  DIFFICULTY_KINDS,
  difficultyLabel,
  kindLabel,
  outcomeLabel,
  roleLabel,
  stageLine,
  statusLabel,
  tokenLine,
} from "../labels";

export const metadata: Metadata = {
  title: "需求執行 — Fluently",
  description:
    "每次產品需求的角色迴圈（編排器、PM、QA、前端、後端）記在你的帳號。",
};

export const dynamic = "force-dynamic";

export default async function AgentRunPage(props: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await props.params;
  const data = await getAgentRun(user.id, id);

  if (!data) {
    return (
      <>
        <SiteHeader compact />
        <main className="flex-1 px-5 py-14 sm:px-8 sm:py-16">
          <div className="mx-auto w-full max-w-6xl">
            <Link
              href="/runs"
              className="text-[13px] text-ink-muted transition-colors hover:text-ink"
            >
              ← 需求執行
            </Link>
            <p className="mt-5 text-[16px] leading-7 text-ink-soft">
              找不到這筆執行。
            </p>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  const { run, turns } = data;
  const difficulties = turns.filter(
    (turn) =>
      turn.difficulty_kind != null &&
      (DIFFICULTY_KINDS as readonly string[]).includes(turn.difficulty_kind),
  );
  const decisions = turns.filter(
    (turn) => turn.decision != null || turn.next_step != null,
  );

  return (
    <>
      <SiteHeader compact />

      <main className="flex-1 px-5 py-14 sm:px-8 sm:py-16">
        <div className="mx-auto w-full max-w-6xl">
          <Link
            href="/runs"
            className="text-[13px] text-ink-muted transition-colors hover:text-ink"
          >
            ← 需求執行
          </Link>

          <h1 className="mt-5 font-display text-[36px] leading-tight tracking-[-0.02em] sm:text-[44px]">
            需求執行
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <StatusChip status={run.status} />
            <span className="text-[15px] text-ink-soft">{stageLine(run)}</span>
          </div>

          <p className="mt-4 max-w-2xl text-[16px] leading-7 text-ink">
            {run.source_request}
          </p>
          <p className="mt-2 font-mono text-[12px] text-ink-muted">
            {tokenLine(run.tokens_in_sum, run.tokens_out_sum)}
          </p>

          <section className="mt-10">
            <h2 className="font-display text-[19px] tracking-tight">
              遇到的困難
            </h2>
            {difficulties.length === 0 ? (
              <p className="mt-3 text-[15px] text-ink-soft">
                目前沒有記錄到的困難。
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {difficulties.map((turn) => (
                  <div
                    key={turn.id}
                    className="rounded-2xl border border-line bg-surface p-5"
                  >
                    <span className="rounded-md bg-clay-wash px-2 py-1 text-[12px] text-clay">
                      {difficultyLabel(turn.difficulty_kind)}
                    </span>
                    {turn.feedback != null && (
                      <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-ink-soft">
                        {turn.feedback}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-10">
            <h2 className="font-display text-[19px] tracking-tight">決策</h2>
            {decisions.length === 0 ? (
              <p className="mt-3 text-[15px] text-ink-soft">
                目前沒有記錄到的決策。
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {decisions.map((turn) => (
                  <div
                    key={turn.id}
                    className="space-y-3 rounded-2xl border border-line bg-surface p-5"
                  >
                    {turn.decision != null && (
                      <Field label="決策">{turn.decision}</Field>
                    )}
                    {turn.next_step != null && (
                      <Field label="下一步">{turn.next_step}</Field>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {turns.length > 0 && (
            <section className="mt-10">
              <div className="overflow-hidden rounded-2xl border border-line">
                {turns.map((turn, i) => (
                  <TurnRow key={turn.id} turn={turn} first={i === 0} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

function StatusChip({ status }: { status: string }) {
  const stopped = status === "stopped";
  return (
    <span
      className={`rounded-md px-2 py-1 text-[12px] ${
        stopped ? "bg-clay-wash text-clay" : "bg-surface-2 text-ink-muted"
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}

function TurnRow({ turn, first }: { turn: AgentTurnRow; first: boolean }) {
  const summary = `${roleLabel(turn.role)} · ${kindLabel(turn.kind)} · 第 ${turn.review_pass} 次`;

  return (
    <details
      className={`group bg-surface ${first ? "" : "border-t border-line"}`}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3.5 transition-colors hover:bg-surface-2">
        <span
          aria-hidden
          className="text-[11px] text-ink-muted transition-transform group-open:rotate-90"
        >
          ▶
        </span>
        <span className="text-[13px] text-ink">{summary}</span>
        <span className="rounded-md bg-surface-2 px-2 py-1 text-[12px] text-ink-muted">
          {outcomeLabel(turn.outcome)}
        </span>
        <span className="w-full truncate font-mono text-[12px] text-ink-muted sm:ml-auto sm:w-auto">
          {tokenLine(turn.tokens_in, turn.tokens_out)}
        </span>
      </summary>

      <div className="space-y-4 border-t border-line bg-surface-2 px-5 py-4 text-[13px]">
        {turn.goal != null && <Field label="Goal">{turn.goal}</Field>}
        {turn.changes != null && <Field label="Changes">{turn.changes}</Field>}
        {turn.feedback != null && <Field label="回饋">{turn.feedback}</Field>}
        {turn.decision != null && <Field label="決策">{turn.decision}</Field>}
        {turn.next_step != null && (
          <Field label="下一步">{turn.next_step}</Field>
        )}
        <Field label="token">
          <span className="font-mono">
            {tokenLine(turn.tokens_in, turn.tokens_out)}
          </span>
        </Field>
      </div>
    </details>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:gap-4">
      <span className="text-[12px] text-ink-muted">{label}</span>
      <div className="min-w-0 whitespace-pre-wrap text-[15px] leading-7 text-ink-soft">
        {children}
      </div>
    </div>
  );
}
