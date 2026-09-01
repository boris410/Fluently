import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Local SQLite store. Server-only — never import this from a Client
 * Component. The file lives in `data/fluently.db` (gitignored).
 *
 * `node:sqlite` ships with Node 22+; no native dependency to install.
 */

export type Role = "user" | "model";

export type StoredMessage = {
  id: number;
  session_id: string;
  role: Role;
  content: string;
  created_at: number;
};

export type CallKind = "chat" | "tts";

export type ApiCall = {
  id: number;
  session_id: string;
  scenario_id: string;
  kind: CallKind;
  model: string;
  voice: string | null;
  prompt_tokens: number;
  output_tokens: number;
  thought_tokens: number;
  total_tokens: number;
  latency_ms: number;
  ok: number;
  error: string | null;
  created_at: number;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL,
  mode        TEXT NOT NULL DEFAULT 'script',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'model')),
  content    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS api_calls (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id     TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  scenario_id    TEXT NOT NULL,
  kind           TEXT NOT NULL DEFAULT 'chat',
  model          TEXT NOT NULL,
  voice          TEXT,
  prompt_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens  INTEGER NOT NULL DEFAULT 0,
  thought_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens   INTEGER NOT NULL DEFAULT 0,
  latency_ms     INTEGER NOT NULL DEFAULT 0,
  ok             INTEGER NOT NULL DEFAULT 1,
  error          TEXT,
  created_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS api_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  platform      TEXT NOT NULL,
  endpoint      TEXT NOT NULL,
  operation     TEXT NOT NULL,
  model         TEXT,
  detail        TEXT,
  session_id    TEXT,
  input         TEXT,
  output        TEXT,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens  INTEGER NOT NULL DEFAULT 0,
  status        INTEGER NOT NULL DEFAULT 0,
  ok            INTEGER NOT NULL DEFAULT 0,
  error         TEXT,
  requested_at  INTEGER NOT NULL,
  returned_at   INTEGER NOT NULL,
  duration_ms   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, id);
CREATE INDEX IF NOT EXISTS idx_calls_session ON api_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_calls_created ON api_calls(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_requested ON api_logs(requested_at);
CREATE INDEX IF NOT EXISTS idx_logs_operation ON api_logs(operation);
`;

/** Adds columns introduced after a database was first created. */
function migrate(db: DatabaseSync) {
  const columnsOf = (table: string) =>
    (
      db.prepare(`PRAGMA table_info(${table})`).all() as unknown as {
        name: string;
      }[]
    ).map((c) => c.name);

  const callColumns = columnsOf("api_calls");
  if (!callColumns.includes("kind")) {
    db.exec("ALTER TABLE api_calls ADD COLUMN kind TEXT NOT NULL DEFAULT 'chat'");
  }
  if (!callColumns.includes("voice")) {
    db.exec("ALTER TABLE api_calls ADD COLUMN voice TEXT");
  }

  if (!columnsOf("sessions").includes("mode")) {
    db.exec(
      "ALTER TABLE sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'script'",
    );
  }

  // Indexed after the column exists, for both fresh and migrated databases.
  db.exec("CREATE INDEX IF NOT EXISTS idx_calls_kind ON api_calls(kind)");
}

function open(): DatabaseSync {
  const dir = join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(join(dir, "fluently.db"));
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

// Reuse across HMR reloads in dev, otherwise every edit leaks a handle.
const globalForDb = globalThis as unknown as { __fluentlyDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (!globalForDb.__fluentlyDb) globalForDb.__fluentlyDb = open();
  return globalForDb.__fluentlyDb;
}

// --- writes ------------------------------------------------------------

export type SessionMode = "script" | "live";

export function createSession(
  scenarioId: string,
  mode: SessionMode = "script",
): string {
  const id = crypto.randomUUID();
  const now = Date.now();
  getDb()
    .prepare(
      "INSERT INTO sessions (id, scenario_id, mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(id, scenarioId, mode, now, now);
  return id;
}

export function sessionExists(id: string): boolean {
  return !!getDb().prepare("SELECT 1 FROM sessions WHERE id = ?").get(id);
}

export function appendMessage(
  sessionId: string,
  role: Role,
  content: string,
): number {
  const now = Date.now();
  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
    )
    .run(sessionId, role, content, now);
  db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(
    now,
    sessionId,
  );
  return Number(result.lastInsertRowid);
}

export function recordCall(call: {
  sessionId: string;
  scenarioId: string;
  kind: CallKind;
  model: string;
  voice?: string | null;
  promptTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  totalTokens: number;
  latencyMs: number;
  ok: boolean;
  error?: string | null;
}) {
  getDb()
    .prepare(
      `INSERT INTO api_calls
        (session_id, scenario_id, kind, model, voice, prompt_tokens, output_tokens,
         thought_tokens, total_tokens, latency_ms, ok, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      call.sessionId,
      call.scenarioId,
      call.kind,
      call.model,
      call.voice ?? null,
      call.promptTokens,
      call.outputTokens,
      call.thoughtTokens,
      call.totalTokens,
      call.latencyMs,
      call.ok ? 1 : 0,
      call.error ?? null,
      Date.now(),
    );
}

// --- reads -------------------------------------------------------------

export function getHistory(sessionId: string, limit = 40): StoredMessage[] {
  return getDb()
    .prepare(
      `SELECT * FROM (
         SELECT * FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT ?
       ) ORDER BY id ASC`,
    )
    .all(sessionId, limit) as unknown as StoredMessage[];
}

export type UsageTotals = {
  calls: number;
  sessions: number;
  prompt_tokens: number;
  output_tokens: number;
  thought_tokens: number;
  total_tokens: number;
  avg_latency: number;
  failures: number;
};

export function getTotals(kind?: CallKind): UsageTotals {
  const row = getDb()
    .prepare(
      `SELECT
         COUNT(*)                                AS calls,
         COUNT(DISTINCT session_id)              AS sessions,
         COALESCE(SUM(prompt_tokens), 0)         AS prompt_tokens,
         COALESCE(SUM(output_tokens), 0)         AS output_tokens,
         COALESCE(SUM(thought_tokens), 0)        AS thought_tokens,
         COALESCE(SUM(total_tokens), 0)          AS total_tokens,
         COALESCE(CAST(AVG(latency_ms) AS INTEGER), 0) AS avg_latency,
         COALESCE(SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END), 0) AS failures
       FROM api_calls
       WHERE (? IS NULL OR kind = ?)`,
    )
    .get(kind ?? null, kind ?? null) as unknown as UsageTotals;
  return row;
}

export type ScenarioUsage = {
  scenario_id: string;
  calls: number;
  sessions: number;
  total_tokens: number;
  prompt_tokens: number;
  output_tokens: number;
};

export function getUsageByScenario(): ScenarioUsage[] {
  return getDb()
    .prepare(
      `SELECT scenario_id,
              COUNT(*)                   AS calls,
              COUNT(DISTINCT session_id) AS sessions,
              COALESCE(SUM(total_tokens), 0)  AS total_tokens,
              COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
              COALESCE(SUM(output_tokens), 0) AS output_tokens
       FROM api_calls
       WHERE kind = 'chat'
       GROUP BY scenario_id
       ORDER BY total_tokens DESC`,
    )
    .all() as unknown as ScenarioUsage[];
}

export type DailyUsage = {
  day: string;
  calls: number;
  total_tokens: number;
};

export function getDailyUsage(days = 14): DailyUsage[] {
  return getDb()
    .prepare(
      `SELECT date(created_at / 1000, 'unixepoch', 'localtime') AS day,
              COUNT(*) AS calls,
              COALESCE(SUM(total_tokens), 0) AS total_tokens
       FROM api_calls
       GROUP BY day
       ORDER BY day DESC
       LIMIT ?`,
    )
    .all(days) as unknown as DailyUsage[];
}

export type SessionSummary = {
  id: string;
  scenario_id: string;
  created_at: number;
  updated_at: number;
  turns: number;
  total_tokens: number;
};

export function getRecentSessions(limit = 12): SessionSummary[] {
  return getDb()
    .prepare(
      `SELECT s.id, s.scenario_id, s.created_at, s.updated_at,
              (SELECT COUNT(*) FROM api_calls c WHERE c.session_id = s.id AND c.kind = 'chat') AS turns,
              (SELECT COALESCE(SUM(total_tokens), 0) FROM api_calls c WHERE c.session_id = s.id) AS total_tokens
       FROM sessions s
       ORDER BY s.updated_at DESC
       LIMIT ?`,
    )
    .all(limit) as unknown as SessionSummary[];
}

export function getRecentCalls(limit = 20): ApiCall[] {
  return getDb()
    .prepare("SELECT * FROM api_calls ORDER BY id DESC LIMIT ?")
    .all(limit) as unknown as ApiCall[];
}

export type SessionStats = {
  calls: number;
  prompt_tokens: number;
  output_tokens: number;
  total_tokens: number;
};

export function getSessionStats(sessionId: string): SessionStats {
  return getDb()
    .prepare(
      `SELECT COUNT(*) AS calls,
              COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
              COALESCE(SUM(output_tokens), 0) AS output_tokens,
              COALESCE(SUM(total_tokens), 0)  AS total_tokens
       FROM api_calls WHERE session_id = ? AND ok = 1 AND kind = 'chat'`,
    )
    .get(sessionId) as unknown as SessionStats;
}

// --- raw API log ---------------------------------------------------------

/** Keeps one row from growing without bound. */
const MAX_TEXT = 4000;

const clip = (value: string | null | undefined) =>
  value == null
    ? null
    : value.length > MAX_TEXT
      ? `${value.slice(0, MAX_TEXT)}…（截斷，原長 ${value.length}）`
      : value;

export type ApiLog = {
  id: number;
  platform: string;
  endpoint: string;
  operation: string;
  model: string | null;
  detail: string | null;
  session_id: string | null;
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
};

/**
 * Records one outbound API call. Logging must never break a request, so
 * every failure here is swallowed after being reported to the console.
 */
export function logApiCall(record: {
  platform: string;
  endpoint: string;
  operation: string;
  model?: string | null;
  detail?: string | null;
  sessionId?: string | null;
  input?: string | null;
  output?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  status: number;
  ok: boolean;
  error?: string | null;
  requestedAt: number;
  returnedAt: number;
  durationMs: number;
}) {
  try {
    getDb()
      .prepare(
        `INSERT INTO api_logs
          (platform, endpoint, operation, model, detail, session_id, input, output,
           input_tokens, output_tokens, total_tokens, status, ok, error,
           requested_at, returned_at, duration_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.platform,
        record.endpoint,
        record.operation,
        record.model ?? null,
        record.detail ?? null,
        record.sessionId ?? null,
        clip(record.input),
        clip(record.output),
        record.inputTokens ?? 0,
        record.outputTokens ?? 0,
        record.totalTokens ?? 0,
        record.status,
        record.ok ? 1 : 0,
        clip(record.error),
        record.requestedAt,
        record.returnedAt,
        record.durationMs,
      );
  } catch (error) {
    console.error("[api_logs] 寫入失敗：", error);
  }
}

export function getRecentLogs(limit = 30): ApiLog[] {
  return getDb()
    .prepare("SELECT * FROM api_logs ORDER BY id DESC LIMIT ?")
    .all(limit) as unknown as ApiLog[];
}

export type LogSummary = {
  operation: string;
  platform: string;
  calls: number;
  failures: number;
  avg_ms: number;
  total_tokens: number;
};

export function getLogSummary(): LogSummary[] {
  return getDb()
    .prepare(
      `SELECT operation, platform,
              COUNT(*) AS calls,
              COALESCE(SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END), 0) AS failures,
              COALESCE(CAST(AVG(duration_ms) AS INTEGER), 0) AS avg_ms,
              COALESCE(SUM(total_tokens), 0) AS total_tokens
       FROM api_logs
       GROUP BY operation, platform
       ORDER BY calls DESC`,
    )
    .all() as unknown as LogSummary[];
}

export type LogFilter = {
  operation?: string;
  status?: "ok" | "failed";
  q?: string;
};

/** Builds the shared WHERE clause so list and count never drift apart. */
function logWhere(filter: LogFilter) {
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (filter.operation) {
    clauses.push("operation = ?");
    params.push(filter.operation);
  }
  if (filter.status === "ok") clauses.push("ok = 1");
  if (filter.status === "failed") clauses.push("ok = 0");
  if (filter.q) {
    clauses.push(
      "(input LIKE ? OR output LIKE ? OR error LIKE ? OR model LIKE ?)",
    );
    const like = `%${filter.q}%`;
    params.push(like, like, like, like);
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export function getLogs(filter: LogFilter, limit: number, offset: number) {
  const { sql, params } = logWhere(filter);
  return getDb()
    .prepare(
      `SELECT * FROM api_logs ${sql} ORDER BY id DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as unknown as ApiLog[];
}

export function countLogs(filter: LogFilter): number {
  const { sql, params } = logWhere(filter);
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM api_logs ${sql}`)
    .get(...params) as unknown as { n: number };
  return row.n;
}

/** Distinct operations present, for building the filter row. */
export function getLogOperations(): string[] {
  return (
    getDb()
      .prepare("SELECT DISTINCT operation FROM api_logs ORDER BY operation")
      .all() as unknown as { operation: string }[]
  ).map((r) => r.operation);
}
