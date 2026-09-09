import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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

// Reads D1 on every request.
export const dynamic = "force-dynamic";

const DAYS = 14;

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
      getDailyUsage(user.id, DAYS),
    ]);
  const daily = fillDays(dailyRaw, DAYS);
  const peak = Math.max(...daily.map((d) => d.total_tokens), 1);

  // Resolve scenario metadata (emoji/title) for the ids referenced above.
  const scenarioIds = Array.from(
    new Set([
      ...byScenario.map((r) => r.scenario_id),
      ...sessions.map((s) => s.scenario_id),
    ]),
  );
  const scenarioById = new Map(
    (await Promise.all(scenarioIds.map((id) => getScenario(id)))).flatMap((s) =>
      s ? [[s.id, s] as const] : [],
    ),
  );

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

          {totals.calls === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-line-strong bg-surface-2 px-6 py-14 text-center">
              <p className="text-[15px] text-ink-soft">還沒有任何對話紀錄。</p>
              <Link
                href="/scenarios"
                className="mt-4 inline-flex h-11 items-center rounded-full bg-clay px-6 text-[15px] font-medium text-on-clay transition-opacity hover:opacity-90"
              >
                去練一段對話
              </Link>
            </div>
          ) : (
            <>
              {/* Headline numbers ------------------------------------ */}
              <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Tile
                  label="對話來回次數"
                  value={chat.calls.toLocaleString()}
                  hint={`${chat.sessions} 段對話`}
                  hero
                />
                <Tile
                  label="對話 token"
                  value={chat.total_tokens.toLocaleString()}
                  hint={
                    chat.calls > 0
                      ? `輸入 ${compact(chat.prompt_tokens)} · 輸出 ${compact(chat.output_tokens)}`
                      : "尚未使用"
                  }
                />
                <Tile
                  label="語音 token"
                  value={tts.total_tokens.toLocaleString()}
                  hint={
                    tts.calls > 0
                      ? `${tts.calls} 次合成 · 平均 ${(tts.avg_latency / 1000).toFixed(1)}s`
                      : "尚未使用 Gemini 語音"
                  }
                />
                <Tile
                  label="全部 token"
                  value={totals.total_tokens.toLocaleString()}
                  hint={
                    totals.failures > 0
                      ? `${totals.failures} 次失敗`
                      : "全部成功"
                  }
                />
              </div>

              {/* Daily series ---------------------------------------- */}
              <section className="mt-10 rounded-2xl border border-line bg-surface p-5 sm:p-6">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="font-display text-[19px] tracking-tight">
                    每日 token 用量
                  </h2>
                  <span className="text-[12px] text-ink-muted">
                    最近 {DAYS} 天
                  </span>
                </div>

                <div className="mt-6 flex h-32 items-end gap-[2px]">
                  {daily.map((d) => {
                    const height = (d.total_tokens / peak) * 100;
                    return (
                      <div
                        key={d.day}
                        title={`${d.day} · ${d.total_tokens.toLocaleString()} tokens · ${d.calls} 次來回`}
                        className="group relative flex-1"
                        style={{ height: "100%" }}
                      >
                        <div className="flex h-full flex-col justify-end">
                          <div
                            style={{ height: `${Math.max(height, 1.5)}%` }}
                            className={`w-full rounded-t-[4px] transition-colors ${
                              d.total_tokens > 0
                                ? "bg-clay group-hover:bg-clay-deep"
                                : "bg-line"
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-2 flex justify-between text-[12px] text-ink-muted">
                  <span className="font-mono">{daily[0]?.day.slice(5)}</span>
                  <span>
                    尖峰 <span className="font-mono">{peak.toLocaleString()}</span>{" "}
                    tokens
                  </span>
                  <span className="font-mono">
                    {daily[daily.length - 1]?.day.slice(5)}
                  </span>
                </div>
              </section>

              {/* Per scenario ---------------------------------------- */}
              <section className="mt-10">
                <h2 className="font-display text-[19px] tracking-tight">
                  各情境用量
                </h2>
                <p className="mt-1.5 text-[13px] text-ink-muted">
                  只計對話呼叫，不含語音合成。
                </p>
                <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
                  <table className="w-full min-w-[560px] border-collapse text-[14px]">
                    <thead>
                      <tr className="border-b border-line bg-surface-2 text-left text-[12px] text-ink-muted">
                        <Th>情境</Th>
                        <Th align="right">來回</Th>
                        <Th align="right">對話</Th>
                        <Th align="right">輸入</Th>
                        <Th align="right">輸出</Th>
                        <Th align="right">總 token</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {byScenario.map((row) => {
                        const scenario = scenarioById.get(row.scenario_id);
                        return (
                          <tr
                            key={row.scenario_id}
                            className="border-b border-line last:border-0 bg-surface"
                          >
                            <Td>
                              <span className="mr-2">
                                {scenario?.emoji ?? "•"}
                              </span>
                              {scenario?.titleZh ?? row.scenario_id}
                            </Td>
                            <Td align="right" mono>
                              {row.calls}
                            </Td>
                            <Td align="right" mono>
                              {row.sessions}
                            </Td>
                            <Td align="right" mono>
                              {row.prompt_tokens.toLocaleString()}
                            </Td>
                            <Td align="right" mono>
                              {row.output_tokens.toLocaleString()}
                            </Td>
                            <Td align="right" mono strong>
                              {row.total_tokens.toLocaleString()}
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Sessions -------------------------------------------- */}
              <section className="mt-10">
                <h2 className="font-display text-[19px] tracking-tight">
                  最近的對話
                </h2>
                <p className="mt-1.5 text-[13px] text-ink-muted">
                  點任一段可以接著上次繼續講。
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sessions.map((s) => {
                    const scenario = scenarioById.get(s.scenario_id);
                    return (
                      <Link
                        key={s.id}
                        href={`/chat/${s.scenario_id}?session=${s.id}`}
                        className="rounded-2xl border border-line bg-surface p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow)]"
                      >
                        <div className="flex items-center gap-2">
                          <span>{scenario?.emoji ?? "•"}</span>
                          <span className="font-display text-[16px] tracking-tight">
                            {scenario?.title ?? s.scenario_id}
                          </span>
                        </div>
                        <p className="mt-2 font-mono text-[12px] text-ink-muted">
                          {new Date(s.updated_at).toLocaleString("zh-TW", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="mt-2 text-[13px] text-ink-soft">
                          {s.turns} 次來回 ·{" "}
                          <span className="font-mono">
                            {s.total_tokens.toLocaleString()}
                          </span>{" "}
                          tokens
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </section>

            </>
          )}

          {/* Raw API log ------------------------------------------- */}
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
                  {logSummary.map((row) => (
                    <span
                      key={`${row.platform}-${row.operation}`}
                      className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-ink-soft"
                    >
                      <span className="text-ink">{row.operation}</span>
                      {" · "}
                      <span className="font-mono">{row.calls}</span> 次
                      {row.failures > 0 && (
                        <span className="text-clay">
                          {" "}
                          （{row.failures} 失敗）
                        </span>
                      )}
                      {" · 平均 "}
                      <span className="font-mono">{row.avg_ms}</span>ms
                    </span>
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

function Tile({
  label,
  value,
  hint,
  hero = false,
}: {
  label: string;
  value: string;
  hint: string;
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
      <p className="mt-2 text-[12px] text-ink-muted">{hint}</p>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-4 py-2.5 font-normal ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  mono = false,
  strong = false,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <td
      className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"} ${
        mono ? "font-mono text-[13px]" : ""
      } ${strong ? "text-ink" : "text-ink-soft"}`}
    >
      {children}
    </td>
  );
}

/** D1 only returns days that have rows; show the empty ones too. */
function fillDays(
  rows: { day: string; calls: number; total_tokens: number }[],
  days: number,
) {
  const found = new Map(rows.map((r) => [r.day, r]));
  const out: { day: string; calls: number; total_tokens: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const day = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    out.push(found.get(day) ?? { day, calls: 0, total_tokens: 0 });
  }
  return out;
}

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
