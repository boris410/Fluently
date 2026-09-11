import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/current-user";
import { countAgentRunsByStatus, listAgentRuns } from "@/lib/db";
import {
  EM_DASH,
  knownTokensTotal,
  stageLine,
  statusLabel,
  tokenLine,
} from "./labels";

export const metadata: Metadata = {
  title: "需求執行 — Fluently",
  description:
    "每次產品需求的角色迴圈（編排器、PM、QA、前端、後端）記在你的帳號。這裡的 token 是 Cursor 子代理用量；練習口說的 Gemini token 仍在用量統計。",
};

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [runs, counts] = await Promise.all([
    listAgentRuns(user.id),
    countAgentRunsByStatus(user.id),
  ]);

  const knownTokens = knownTokensTotal(runs);

  return (
    <>
      <SiteHeader compact />

      <main className="flex-1 px-5 py-14 sm:px-8 sm:py-16">
        <div className="mx-auto w-full max-w-6xl">
          <Link
            href="/"
            className="text-[13px] text-ink-muted transition-colors hover:text-ink"
          >
            ← 回首頁
          </Link>

          <h1 className="mt-5 font-display text-[36px] leading-tight tracking-[-0.02em] sm:text-[44px]">
            需求執行
          </h1>
          <p className="mt-3 max-w-xl text-[16px] leading-7 text-ink-soft">
            每次產品需求的角色迴圈（編排器、PM、QA、前端、後端）記在你的帳號。這裡的
            token 是 Cursor 子代理用量；練習口說的 Gemini token 仍在用量統計。
          </p>

          {runs.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-line-strong bg-surface-2 px-6 py-14 text-center">
              <p className="text-[15px] text-ink-soft">
                還沒有任何需求執行紀錄。
              </p>
            </div>
          ) : (
            <>
              <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Tile
                  label="進行中"
                  value={counts.running_count.toLocaleString()}
                  hero
                />
                <Tile
                  label="已完成"
                  value={counts.passed_count.toLocaleString()}
                />
                <Tile
                  label="已停止"
                  value={counts.stopped_count.toLocaleString()}
                />
                <Tile
                  label="已知 token"
                  value={
                    knownTokens == null ? EM_DASH : knownTokens.toLocaleString()
                  }
                />
              </div>

              <div className="mt-10 grid gap-3">
                {runs.map((run) => (
                  <Link
                    key={run.id}
                    href={`/runs/${run.id}`}
                    className="rounded-2xl border border-line bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow)]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip status={run.status} />
                      <span className="text-[13px] text-ink-muted">
                        {stageLine(run)}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-[15px] text-ink">
                      {run.source_request}
                    </p>
                    <p className="mt-2 font-mono text-[12px] text-ink-muted">
                      {tokenLine(run.tokens_in_sum, run.tokens_out_sum)}
                    </p>
                  </Link>
                ))}
              </div>
            </>
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

function Tile({
  label,
  value,
  hero = false,
}: {
  label: string;
  value: string;
  hero?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-[12px] text-ink-muted">{label}</p>
      <p
        className={`mt-2 font-display tracking-tight ${
          hero ? "text-[34px] text-clay" : "text-[28px]"
        } leading-none`}
      >
        {value}
      </p>
    </div>
  );
}
