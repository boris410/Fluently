import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogSummaryChip } from "@/components/logs-body";
import {
  UsageBody,
  type DailyUsageView,
  type LogSummaryView,
  type ScenarioMeta,
  type ScenarioUsageView,
  type SessionView,
  type UsageTotalsView,
} from "@/components/usage-body";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/current-user";
import {
  countLogs,
  getDailyUsage,
  getLogSummary,
  getRecentSessions,
  getScenario,
  getTotals,
  getUsageByScenario,
} from "@/lib/db";

export const metadata: Metadata = {
  title: "用量統計 — Fluently",
  description: "每次對話送出與收到的 token、來回次數與延遲。",
};

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [totals, chat, tts, byScenario, sessions, logCount, logSummary, dailyRaw] =
    await Promise.all([
      getTotals(user.id),
      getTotals(user.id, "chat"),
      getTotals(user.id, "tts"),
      getUsageByScenario(user.id),
      getRecentSessions(user.id),
      countLogs(user.id, {}),
      getLogSummary(user.id),
      getDailyUsage(user.id, 14),
    ]);

  const scenarioIds = Array.from(
    new Set([
      ...byScenario.map((r) => r.scenario_id),
      ...sessions.map((s) => s.scenario_id),
    ]),
  );
  const scenarios: ScenarioMeta[] = (
    await Promise.all(scenarioIds.map((id) => getScenario(id)))
  ).flatMap((s) =>
    s
      ? [{ id: s.id, emoji: s.emoji, title: s.title, titleZh: s.titleZh }]
      : [],
  );

  const mappedSummary = logSummary.map(mapLogSummary);

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
            用量統計
          </h1>
          <p className="mt-3 max-w-xl text-[16px] leading-7 text-ink-soft">
            每一次送出到 Gemini 的來回都記在你的帳號，token 數字取自 API
            回傳的 <code className="font-mono text-[14px]">usageMetadata</code>，
            不是估算值。
          </p>

          <UsageBody
            totals={mapTotals(totals)}
            chat={mapTotals(chat)}
            tts={mapTotals(tts)}
            byScenario={byScenario.map(mapScenarioUsage)}
            sessions={sessions.map(mapSession)}
            daily={dailyRaw.map(mapDaily)}
            scenarios={scenarios}
          />

          <section className="mt-14">
            <h2 className="font-display text-[19px] tracking-tight">
              API 呼叫紀錄
            </h2>
            <p className="mt-1.5 text-[13px] text-ink-muted">
              每一次對外呼叫都記在 <code className="font-mono">api_logs</code>{" "}
              表：平台、模型、送出與收到的內容、狀態碼、耗時。
            </p>

            {logCount === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-line-strong bg-surface-2 px-6 py-10 text-center text-[14px] text-ink-soft">
                還沒有任何 API 呼叫。
              </div>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  {mappedSummary.map((row) => (
                    <LogSummaryChip
                      key={`${row.platform}-${row.operation}`}
                      row={row}
                    />
                  ))}
                </div>

                <Link
                  href="/logs"
                  className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-medium text-clay transition-opacity hover:opacity-75"
                >
                  看完整紀錄（可篩選、搜尋、展開全文）→
                </Link>
              </>
            )}
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

function mapTotals(row: {
  calls: number;
  sessions: number;
  prompt_tokens: number;
  output_tokens: number;
  thought_tokens: number;
  total_tokens: number;
  avg_latency: number;
  failures: number;
}): UsageTotalsView {
  return {
    calls: row.calls,
    sessions: row.sessions,
    promptTokens: row.prompt_tokens,
    outputTokens: row.output_tokens,
    thoughtTokens: row.thought_tokens,
    totalTokens: row.total_tokens,
    avgLatency: row.avg_latency,
    failures: row.failures,
  };
}

function mapScenarioUsage(row: {
  scenario_id: string;
  calls: number;
  sessions: number;
  total_tokens: number;
  prompt_tokens: number;
  output_tokens: number;
}): ScenarioUsageView {
  return {
    scenarioId: row.scenario_id,
    calls: row.calls,
    sessions: row.sessions,
    totalTokens: row.total_tokens,
    promptTokens: row.prompt_tokens,
    outputTokens: row.output_tokens,
  };
}

function mapSession(row: {
  id: string;
  scenario_id: string;
  created_at: number;
  updated_at: number;
  turns: number;
  total_tokens: number;
}): SessionView {
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    turns: row.turns,
    totalTokens: row.total_tokens,
  };
}

function mapDaily(row: {
  day: string;
  calls: number;
  total_tokens: number;
}): DailyUsageView {
  return {
    day: row.day,
    calls: row.calls,
    totalTokens: row.total_tokens,
  };
}

function mapLogSummary(row: {
  operation: string;
  platform: string;
  calls: number;
  failures: number;
  avg_ms: number;
  total_tokens: number;
}): LogSummaryView {
  return {
    operation: row.operation,
    platform: row.platform,
    calls: row.calls,
    failures: row.failures,
    avgMs: row.avg_ms,
    totalTokens: row.total_tokens,
  };
}
