import { getCurrentUser } from "@/lib/current-user";
import {
  type ApiLog,
  type LogFilter,
  type LogSummary,
  countLogs,
  getLogOperations,
  getLogSummary,
  getLogs,
} from "@/lib/db";

const UNAUTH = { error: "請先登入" };
const READ_FAIL = { error: "無法讀取呼叫紀錄" };
const PAGE_SIZE = 25;

function logSummaryToJson(row: LogSummary) {
  return {
    operation: row.operation,
    platform: row.platform,
    calls: row.calls,
    failures: row.failures,
    avgMs: row.avg_ms,
    totalTokens: row.total_tokens,
  };
}

function logToJson(row: ApiLog) {
  return {
    id: row.id,
    platform: row.platform,
    endpoint: row.endpoint,
    operation: row.operation,
    model: row.model,
    detail: row.detail,
    sessionId: row.session_id,
    userStudentId: row.user_student_id,
    input: row.input,
    output: row.output,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
    status: row.status,
    ok: row.ok === 1,
    error: row.error,
    requestedAt: row.requested_at,
    returnedAt: row.returned_at,
    durationMs: row.duration_ms,
  };
}

function one(url: URL, key: string): string | undefined {
  const value = url.searchParams.get(key);
  return value == null ? undefined : value;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json(UNAUTH, { status: 401 });

  const url = new URL(request.url);
  const operation = one(url, "op") || undefined;
  const statusParam = one(url, "status");
  const status =
    statusParam === "ok" || statusParam === "failed" ? statusParam : undefined;
  const q = one(url, "q")?.trim() || undefined;
  const page = Math.max(1, Number(one(url, "page") ?? "1") || 1);

  const filter: LogFilter = { operation, status, q };

  try {
    const total = await countLogs(user.id, filter);
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const current = Math.min(page, pages);
    const [logs, operations, summary, grandTotal] = await Promise.all([
      getLogs(user.id, filter, PAGE_SIZE, (current - 1) * PAGE_SIZE),
      getLogOperations(user.id),
      getLogSummary(user.id),
      countLogs(user.id, {}),
    ]);

    return Response.json({
      logs: logs.map(logToJson),
      total,
      grandTotal,
      page: current,
      pages,
      operations,
      summary: summary.map(logSummaryToJson),
    });
  } catch (error) {
    console.error("[api/logs] 讀取失敗：", error);
    return Response.json(READ_FAIL, { status: 500 });
  }
}
