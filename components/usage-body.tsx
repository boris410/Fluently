import Link from "next/link";

export type UsageTotalsView = {
  calls: number;
  sessions: number;
  promptTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  totalTokens: number;
  avgLatency: number;
  failures: number;
};

export type ScenarioUsageView = {
  scenarioId: string;
  calls: number;
  sessions: number;
  totalTokens: number;
  promptTokens: number;
  outputTokens: number;
};

export type SessionView = {
  id: string;
  scenarioId: string;
  createdAt: number;
  updatedAt: number;
  turns: number;
  totalTokens: number;
};

export type DailyUsageView = {
  day: string;
  calls: number;
  totalTokens: number;
};

export type ScenarioMeta = {
  id: string;
  emoji: string;
  title: string;
  titleZh: string;
};

export type LogSummaryView = {
  operation: string;
  platform: string;
  calls: number;
  failures: number;
  avgMs: number;
  totalTokens: number;
};

export type UsagePayload = {
  totals: UsageTotalsView;
  chat: UsageTotalsView;
  tts: UsageTotalsView;
  byScenario: ScenarioUsageView[];
  sessions: SessionView[];
  logCount: number;
  logSummary: LogSummaryView[];
  daily: DailyUsageView[];
  scenarios: ScenarioMeta[];
};

const DAYS = 14;

export function UsageBody({
  totals,
  chat,
  tts,
  byScenario,
  sessions,
  daily,
  scenarios,
}: {
  totals: UsageTotalsView;
  chat: UsageTotalsView;
  tts: UsageTotalsView;
  byScenario: ScenarioUsageView[];
  sessions: SessionView[];
  daily: DailyUsageView[];
  scenarios: ScenarioMeta[];
}) {
  if (totals.calls === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-dashed border-line-strong bg-surface-2 px-6 py-14 text-center">
        <p className="text-[15px] text-ink-soft">還沒有任何對話紀錄。</p>
        <Link
          href="/scenarios"
          className="mt-4 inline-flex h-11 items-center rounded-full bg-clay px-6 text-[15px] font-medium text-on-clay transition-opacity hover:opacity-90"
        >
          去練一段對話
        </Link>
      </div>
    );
  }

  const filled = fillDays(daily, DAYS);
  const peak = Math.max(...filled.map((d) => d.totalTokens), 1);
  const scenarioById = new Map(scenarios.map((s) => [s.id, s]));

  return (
    <>
      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="對話來回次數"
          value={chat.calls.toLocaleString()}
          hint={`${chat.sessions} 段對話`}
          hero
        />
        <Tile
          label="對話 token"
          value={chat.totalTokens.toLocaleString()}
          hint={
            chat.calls > 0
              ? `輸入 ${compact(chat.promptTokens)} · 輸出 ${compact(chat.outputTokens)}`
              : "尚未使用"
          }
        />
        <Tile
          label="語音 token"
          value={tts.totalTokens.toLocaleString()}
          hint={
            tts.calls > 0
              ? `${tts.calls} 次合成 · 平均 ${(tts.avgLatency / 1000).toFixed(1)}s`
              : "尚未使用 Gemini 語音"
          }
        />
        <Tile
          label="全部 token"
          value={totals.totalTokens.toLocaleString()}
          hint={
            totals.failures > 0
              ? `${totals.failures} 次失敗`
              : "全部成功"
          }
        />
      </div>

      <section className="mt-10 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-[19px] tracking-tight">
            每日 token 用量
          </h2>
          <span className="text-[12px] text-ink-muted">最近 {DAYS} 天</span>
        </div>

        <div className="mt-6 flex h-32 items-end gap-[2px]">
          {filled.map((d) => {
            const height = (d.totalTokens / peak) * 100;
            return (
              <div
                key={d.day}
                title={`${d.day} · ${d.totalTokens.toLocaleString()} tokens · ${d.calls} 次呼叫`}
                className="group relative flex-1"
                style={{ height: "100%" }}
              >
                <div className="flex h-full flex-col justify-end">
                  <div
                    style={{ height: `${Math.max(height, 1.5)}%` }}
                    className={`w-full rounded-t-[4px] transition-colors ${
                      d.totalTokens > 0
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
          <span className="font-mono">{filled[0]?.day.slice(5)}</span>
          <span>
            尖峰 <span className="font-mono">{peak.toLocaleString()}</span> tokens
          </span>
          <span className="font-mono">
            {filled[filled.length - 1]?.day.slice(5)}
          </span>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-[19px] tracking-tight">各情境用量</h2>
        <p className="mt-1.5 text-[13px] text-ink-muted">
          只計對話呼叫，不含語音合成、談話回饋與結束判斷。
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
                const scenario = scenarioById.get(row.scenarioId);
                return (
                  <tr
                    key={row.scenarioId}
                    className="border-b border-line last:border-0 bg-surface"
                  >
                    <Td>
                      <span className="mr-2">{scenario?.emoji ?? "•"}</span>
                      {scenario?.titleZh ?? row.scenarioId}
                    </Td>
                    <Td align="right" mono>
                      {row.calls}
                    </Td>
                    <Td align="right" mono>
                      {row.sessions}
                    </Td>
                    <Td align="right" mono>
                      {row.promptTokens.toLocaleString()}
                    </Td>
                    <Td align="right" mono>
                      {row.outputTokens.toLocaleString()}
                    </Td>
                    <Td align="right" mono strong>
                      {row.totalTokens.toLocaleString()}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-[19px] tracking-tight">最近的對話</h2>
        <p className="mt-1.5 text-[13px] text-ink-muted">
          點任一段可以接著上次繼續講。
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => {
            const scenario = scenarioById.get(s.scenarioId);
            return (
              <Link
                key={s.id}
                href={`/chat/${s.scenarioId}?session=${s.id}`}
                className="rounded-2xl border border-line bg-surface p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow)]"
              >
                <div className="flex items-center gap-2">
                  <span>{scenario?.emoji ?? "•"}</span>
                  <span className="font-display text-[16px] tracking-tight">
                    {scenario?.title ?? s.scenarioId}
                  </span>
                </div>
                <p className="mt-2 font-mono text-[12px] text-ink-muted">
                  {new Date(s.updatedAt).toLocaleString("zh-TW", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="mt-2 text-[13px] text-ink-soft">
                  {s.turns} 次來回 ·{" "}
                  <span className="font-mono">
                    {s.totalTokens.toLocaleString()}
                  </span>{" "}
                  tokens
                </p>
              </Link>
            );
          })}
        </div>
      </section>
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
function fillDays(rows: DailyUsageView[], days: number): DailyUsageView[] {
  const found = new Map(rows.map((r) => [r.day, r]));
  const out: DailyUsageView[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const day = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    out.push(found.get(day) ?? { day, calls: 0, totalTokens: 0 });
  }
  return out;
}

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
