import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  type ApiLog,
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
  const total = await countLogs(filter);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const [logs, operations, summary, grandTotal] = await Promise.all([
    getLogs(filter, PAGE_SIZE, (current - 1) * PAGE_SIZE),
    getLogOperations(),
    getLogSummary(),
    countLogs({}),
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

          {grandTotal === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-line-strong bg-surface-2 px-6 py-14 text-center">
              <p className="text-[15px] text-ink-soft">還沒有任何 API 呼叫。</p>
              <Link
                href="/scenarios"
                className="mt-4 inline-flex h-11 items-center rounded-full bg-clay px-6 text-[15px] font-medium text-on-clay transition-opacity hover:opacity-90"
              >
                去練一段對話
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-8 flex flex-wrap gap-2">
                {summary.map((row) => (
                  <span
                    key={`${row.platform}-${row.operation}`}
                    className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-ink-soft"
                  >
                    <span className="text-ink">{row.operation}</span>
                    {" · "}
                    <span className="font-mono">{row.calls}</span> 次
                    {row.failures > 0 && (
                      <span className="text-clay"> （{row.failures} 失敗）</span>
                    )}
                    {" · 平均 "}
                    <span className="font-mono">{row.avg_ms}</span>ms
                  </span>
                ))}
              </div>

              {/* Filters are plain links, so the page stays fully server-rendered. */}
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
                  {operation && <input type="hidden" name="op" value={operation} />}
                  {status && <input type="hidden" name="status" value={status} />}
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

              <p className="mt-4 text-[13px] text-ink-muted">
                {total.toLocaleString()} 筆
                {total !== grandTotal && `（全部 ${grandTotal.toLocaleString()} 筆）`}
                {pages > 1 && ` · 第 ${current} / ${pages} 頁`}
              </p>

              <div className="mt-4 overflow-hidden rounded-2xl border border-line">
                {logs.map((log, i) => (
                  <LogRow key={log.id} log={log} first={i === 0} />
                ))}
                {logs.length === 0 && (
                  <p className="bg-surface px-5 py-10 text-center text-[14px] text-ink-soft">
                    沒有符合條件的紀錄。
                  </p>
                )}
              </div>

              {pages > 1 && (
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
              )}
            </>
          )}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

/** One entry. `<details>` keeps expansion working without any client JS. */
function LogRow({ log, first }: { log: ApiLog; first: boolean }) {
  const time = new Date(log.returned_at).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

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
        <span className="font-mono text-[12px] text-ink-muted">{time}</span>
        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[12px]">
          {log.operation}
        </span>
        <span className="font-mono text-[12px] text-ink-soft">
          {log.model ?? log.platform}
        </span>
        <span
          className={`rounded px-1.5 py-0.5 font-mono text-[12px] ${
            log.ok ? "text-ink-muted" : "bg-clay-wash text-clay"
          }`}
        >
          {log.status}
        </span>
        <span className="font-mono text-[12px] text-ink-muted">
          {log.duration_ms}ms
        </span>
        {log.total_tokens > 0 && (
          <span className="font-mono text-[12px] text-ink-muted">
            ↑{log.input_tokens} ↓{log.output_tokens}
          </span>
        )}
        <span className="w-full truncate text-[13px] text-ink-soft sm:w-auto sm:flex-1">
          {log.error ?? log.input ?? log.output ?? "—"}
        </span>
      </summary>

      <div className="space-y-4 border-t border-line bg-surface-2 px-5 py-4 text-[13px]">
        <Field label="平台 / 端點">
          <span className="font-mono break-all">
            {log.platform} · {log.endpoint}
          </span>
        </Field>
        {log.detail && (
          <Field label="參數">
            <span className="font-mono">{log.detail}</span>
          </Field>
        )}
        <Field label="送出時間 → 收到時間">
          <span className="font-mono">
            {new Date(log.requested_at).toLocaleString("zh-TW")} →{" "}
            {new Date(log.returned_at).toLocaleString("zh-TW")}（
            {log.duration_ms}ms）
          </span>
        </Field>
        {log.session_id && (
          <Field label="Session">
            <span className="font-mono break-all">{log.session_id}</span>
          </Field>
        )}
        <Field label="輸入">
          <Body text={log.input} />
        </Field>
        <Field label="輸出">
          <Body text={log.output} />
        </Field>
        {log.error && (
          <Field label="錯誤">
            <span className="text-clay">{log.error}</span>
          </Field>
        )}
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
      <div className="min-w-0 text-ink-soft">{children}</div>
    </div>
  );
}

function Body({ text }: { text: string | null }) {
  if (!text) return <span className="text-ink-muted">—</span>;
  return (
    <pre className="max-h-64 overflow-auto rounded-lg border border-line bg-surface px-3 py-2 font-sans text-[13px] leading-6 whitespace-pre-wrap">
      {text}
    </pre>
  );
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
