import Link from "next/link";
import type { ReactNode } from "react";
import type { LogSummaryView } from "@/components/usage-body";

export type LogView = {
  id: number;
  platform: string;
  endpoint: string;
  operation: string;
  model: string | null;
  detail: string | null;
  sessionId: string | null;
  userStudentId: string | null;
  input: string | null;
  output: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  status: number;
  ok: boolean;
  error: string | null;
  requestedAt: number;
  returnedAt: number;
  durationMs: number;
};

export type LogsPayload = {
  logs: LogView[];
  total: number;
  grandTotal: number;
  page: number;
  pages: number;
  operations: string[];
  summary: LogSummaryView[];
};

export function LogsBody({
  logs,
  total,
  grandTotal,
  page,
  pages,
  summary,
  toolbar,
  pagination,
}: {
  logs: LogView[];
  total: number;
  grandTotal: number;
  page: number;
  pages: number;
  summary: LogSummaryView[];
  toolbar?: ReactNode;
  pagination?: ReactNode;
}) {
  if (grandTotal === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-dashed border-line-strong bg-surface-2 px-6 py-14 text-center">
        <p className="text-[15px] text-ink-soft">還沒有任何 API 呼叫。</p>
        <Link
          href="/scenarios"
          className="mt-4 inline-flex h-11 items-center rounded-full bg-clay px-6 text-[15px] font-medium text-on-clay transition-opacity hover:opacity-90"
        >
          去練一段對話
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mt-8 flex flex-wrap gap-2">
        {summary.map((row) => (
          <LogSummaryChip key={`${row.platform}-${row.operation}`} row={row} />
        ))}
      </div>

      {toolbar}

      <p className="mt-4 text-[13px] text-ink-muted">
        {total.toLocaleString()} 筆
        {total !== grandTotal && `（全部 ${grandTotal.toLocaleString()} 筆）`}
        {pages > 1 && ` · 第 ${page} / ${pages} 頁`}
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

      {pages > 1 && pagination}
    </>
  );
}

export function LogSummaryChip({ row }: { row: LogSummaryView }) {
  return (
    <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-ink-soft">
      <span className="text-ink">{row.operation}</span>
      {" · "}
      <span className="font-mono">{row.calls}</span> 次
      {row.failures > 0 && (
        <span className="text-clay"> （{row.failures} 失敗）</span>
      )}
      {" · 平均 "}
      <span className="font-mono">{row.avgMs}</span>ms
    </span>
  );
}

function LogRow({ log, first }: { log: LogView; first: boolean }) {
  const time = new Date(log.returnedAt).toLocaleString("zh-TW", {
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
          {log.durationMs}ms
        </span>
        {log.totalTokens > 0 && (
          <span className="font-mono text-[12px] text-ink-muted">
            ↑{log.inputTokens} ↓{log.outputTokens}
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
            {new Date(log.requestedAt).toLocaleString("zh-TW")} →{" "}
            {new Date(log.returnedAt).toLocaleString("zh-TW")}（
            {log.durationMs}ms）
          </span>
        </Field>
        {log.sessionId && (
          <Field label="Session">
            <span className="font-mono break-all">{log.sessionId}</span>
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
