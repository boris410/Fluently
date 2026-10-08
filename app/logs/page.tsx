import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogsBody, type LogView } from "@/components/logs-body";
import type { LogSummaryView } from "@/components/usage-body";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/current-user";
import {
  type LogFilter,
  countLogs,
  getLogOperations,
  getLogSummary,
  getLogs,
} from "@/lib/db";

export const metadata: Metadata = {
  title: "API 呼叫紀錄 — Fluently",
  description: "每一次對外 API 呼叫的原始紀錄：送出、收到、狀態與耗時。",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function LogsPage(props: PageProps<"/logs">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await props.searchParams;
  const one = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined;

  const operation = one("op");
  const statusParam = one("status");
  const status =
    statusParam === "ok" || statusParam === "failed" ? statusParam : undefined;
  const q = one("q")?.trim() || undefined;
  const page = Math.max(1, Number(one("page") ?? "1") || 1);

  const filter: LogFilter = { operation, status, q };
  const total = await countLogs(user.id, filter);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const [logs, operations, summary, grandTotal] = await Promise.all([
    getLogs(user.id, filter, PAGE_SIZE, (current - 1) * PAGE_SIZE),
    getLogOperations(user.id),
    getLogSummary(user.id),
    countLogs(user.id, {}),
  ]);

  const href = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { op: operation, status, q, page: undefined, ...patch };
    for (const [key, value] of Object.entries(merged)) {
      if (value) next.set(key, value);
    }
    const query = next.toString();
    return query ? `/logs?${query}` : "/logs";
  };

  return (
    <>
      <SiteHeader compact />

      <main className="flex-1 px-5 py-14 sm:px-8 sm:py-16">
        <div className="mx-auto w-full max-w-6xl">
          <Link
            href="/usage"
            className="text-[13px] text-ink-muted transition-colors hover:text-ink"
          >
            ← 用量統計
          </Link>

          <h1 className="mt-5 font-display text-[36px] leading-tight tracking-[-0.02em] sm:text-[44px]">
            API 呼叫紀錄
          </h1>
          <p className="mt-3 max-w-2xl text-[16px] leading-7 text-ink-soft">
            <code className="font-mono text-[14px]">api_logs</code>{" "}
            表的內容：每一次對外呼叫的平台、模型、送出與收到的實際內容、HTTP
            狀態碼與耗時。點任一列可以展開全文。
          </p>

          <LogsBody
            logs={logs.map(mapLog)}
            total={total}
            grandTotal={grandTotal}
            page={current}
            pages={pages}
            summary={summary.map(mapLogSummary)}
            toolbar={
              grandTotal > 0 ? (
                <div className="mt-6 flex flex-col gap-3 border-y border-line py-4 sm:flex-row sm:items-center">
                  <FilterGroup label="操作">
                    <Pill href={href({ op: undefined })} active={!operation}>
                      全部
                    </Pill>
                    {operations.map((op) => (
                      <Pill
                        key={op}
                        href={href({ op })}
                        active={operation === op}
                      >
                        {op}
                      </Pill>
                    ))}
                  </FilterGroup>

                  <FilterGroup label="狀態">
                    <Pill href={href({ status: undefined })} active={!status}>
                      全部
                    </Pill>
                    <Pill href={href({ status: "ok" })} active={status === "ok"}>
                      成功
                    </Pill>
                    <Pill
                      href={href({ status: "failed" })}
                      active={status === "failed"}
                    >
                      失敗
                    </Pill>
                  </FilterGroup>

                  <form action="/logs" className="flex gap-2 sm:ml-auto">
                    {operation && (
                      <input type="hidden" name="op" value={operation} />
                    )}
                    {status && (
                      <input type="hidden" name="status" value={status} />
                    )}
                    <input
                      type="search"
                      name="q"
                      defaultValue={q ?? ""}
                      placeholder="搜尋內容或模型"
                      className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-muted focus:border-line-strong focus:outline-none sm:w-56"
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-lg border border-line-strong px-3 py-2 text-[13px] text-ink transition-colors hover:border-clay hover:text-clay"
                    >
                      搜尋
                    </button>
                  </form>
                </div>
              ) : null
            }
            pagination={
              <div className="mt-6 flex items-center justify-between">
                <PageLink
                  href={href({ page: String(current - 1) })}
                  disabled={current <= 1}
                >
                  ← 上一頁
                </PageLink>
                <span className="font-mono text-[13px] text-ink-muted">
                  {current} / {pages}
                </span>
                <PageLink
                  href={href({ page: String(current + 1) })}
                  disabled={current >= pages}
                >
                  下一頁 →
                </PageLink>
              </div>
            }
          />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

function mapLog(log: {
  id: number;
  platform: string;
  endpoint: string;
  operation: string;
  model: string | null;
  detail: string | null;
  session_id: string | null;
  user_student_id: string | null;
  input: string | null;
  output: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  status: number;
  ok: number;
  error: string | null;
  requested_at: number;
  returned_at: number;
  duration_ms: number;
}): LogView {
  return {
    id: log.id,
    platform: log.platform,
    endpoint: log.endpoint,
    operation: log.operation,
    model: log.model,
    detail: log.detail,
    sessionId: log.session_id,
    userStudentId: log.user_student_id,
    input: log.input,
    output: log.output,
    inputTokens: log.input_tokens,
    outputTokens: log.output_tokens,
    totalTokens: log.total_tokens,
    status: log.status,
    ok: log.ok === 1,
    error: log.error,
    requestedAt: log.requested_at,
    returnedAt: log.returned_at,
    durationMs: log.duration_ms,
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

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-ink-muted">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Pill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
        active
          ? "border-clay bg-clay text-on-clay"
          : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-full border border-line px-4 py-2 text-[13px] text-ink-muted opacity-50">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-full border border-line-strong px-4 py-2 text-[13px] text-ink transition-colors hover:border-clay hover:text-clay"
    >
      {children}
    </Link>
  );
}
