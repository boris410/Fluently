import { type Level, type RoleType, type Scenario } from "@/lib/scenarios";

/**
 * Data layer. Server-only — never import this from a Client Component.
 *
 * One driver: Cloudflare D1 via `getCloudflareContext().env.DB`. Thanks to
 * `initOpenNextCloudflareForDev()` in next.config.ts, the binding is also
 * available under `next dev` (miniflare's local D1), so dev and prod share the
 * exact same code path. Apply migrations locally with
 * `wrangler d1 migrations apply fluently_db --local`.
 *
 * D1's API is async, so every exported function returns a Promise.
 *
 * Multi-user: every read/write is scoped by `userId` (the better-auth
 * `user.id`, mirrored into `sessions.user_student_id`). Callers resolve the
 * user via `getCurrentUser()` and must pass the id in.
 */

export type MessageRole = "user" | "model";
/** @deprecated use MessageRole */
export type Role = MessageRole;

export type StoredMessage = {
  id: number;
  session_id: string;
  role: MessageRole;
  user_student_id: string | null;
  character_id: string | null;
  content: string;
  created_at: number;
};

export type CallKind = "chat" | "tts";

export type ApiCall = {
  id: number;
  session_id: string;
  kind: CallKind;
  model: string;
  prompt_tokens: number;
  output_tokens: number;
  thought_tokens: number;
  total_tokens: number;
  latency_ms: number;
  ok: number;
  error: string | null;
  created_at: number;
};

// --- adapter -----------------------------------------------------------

type SqlParam = string | number | null;

interface Db {
  all<T = Record<string, unknown>>(
    sql: string,
    params?: SqlParam[],
  ): Promise<T[]>;
  first<T = Record<string, unknown>>(
    sql: string,
    params?: SqlParam[],
  ): Promise<T | undefined>;
  run(
    sql: string,
    params?: SqlParam[],
  ): Promise<{ lastInsertRowid: number }>;
}

/**
 * Minimal structural type for the D1 binding we use. We deliberately avoid
 * `@cloudflare/workers-types` globals here: pulling them in overrides the DOM
 * lib (e.g. `Response.json()` would return `unknown`) and breaks client code.
 */
interface D1PreparedStatement {
  bind(...values: SqlParam[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results?: T[] }>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<{ meta?: { last_row_id?: number } }>;
}
interface D1DatabaseLike {
  prepare(sql: string): D1PreparedStatement;
}

function d1Adapter(db: D1DatabaseLike): Db {
  const bound = (sql: string, params: SqlParam[]) => {
    const stmt = db.prepare(sql);
    return params.length ? stmt.bind(...params) : stmt;
  };
  return {
    async all(sql, params = []) {
      const res = await bound(sql, params).all();
      return (res.results ?? []) as never;
    },
    async first(sql, params = []) {
      return ((await bound(sql, params).first()) ?? undefined) as never;
    },
    async run(sql, params = []) {
      const res = await bound(sql, params).run();
      return { lastInsertRowid: Number(res.meta?.last_row_id ?? 0) };
    },
  };
}

// --- driver ------------------------------------------------------------

async function getDb(): Promise<Db> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const { env } = await getCloudflareContext({ async: true });
  const d1 = (env as unknown as { DB?: D1DatabaseLike }).DB;
  if (!d1) {
    throw new Error(
      "D1 binding `DB` 不存在。本機請先跑 `wrangler d1 migrations apply fluently_db --local`。",
    );
  }
  return d1Adapter(d1);
}

// --- scenarios ---------------------------------------------------------

type ScenarioRow = {
  id: string;
  title: string;
  title_zh: string;
  blurb: string;
  level: Level;
  focus: string;
  opening: string;
  persona: string;
  role_type: RoleType;
  emoji: string;
  tint_light: string;
  tint_dark: string;
};

function hydrateScenario(row: ScenarioRow): Scenario {
  let focus: string[] = [];
  try {
    const parsed = JSON.parse(row.focus) as unknown;
    if (Array.isArray(parsed)) focus = parsed.map(String);
  } catch {
    focus = [];
  }
  return {
    id: row.id,
    emoji: row.emoji,
    title: row.title,
    titleZh: row.title_zh,
    blurb: row.blurb,
    level: row.level,
    roleType: row.role_type,
    persona: row.persona,
    focus,
    opening: row.opening,
    tint: [row.tint_light, row.tint_dark],
  };
}

const SCENARIO_SELECT = `
  SELECT sc.id, sc.title, sc.title_zh, sc.blurb, sc.level, sc.focus, sc.opening,
         sc.persona, sc.role_type, sn.emoji, sn.tint_light, sn.tint_dark
  FROM scenarios sc
  JOIN scenes sn ON sn.id = sc.scene_id
`;

export async function listScenarios(): Promise<Scenario[]> {
  const db = await getDb();
  const rows = await db.all<ScenarioRow>(
    `${SCENARIO_SELECT} ORDER BY sc.sort_order ASC, sc.id ASC`,
  );
  return rows.map(hydrateScenario);
}

export async function getScenario(id: string): Promise<Scenario | undefined> {
  const db = await getDb();
  const row = await db.first<ScenarioRow>(
    `${SCENARIO_SELECT} WHERE sc.id = ? LIMIT 1`,
    [id],
  );
  return row ? hydrateScenario(row) : undefined;
}

/** Voice for a session: session -> scenario -> character -> voice. */
export async function resolveSessionVoiceId(
  sessionId: string,
): Promise<string | null> {
  const db = await getDb();
  const row = await db.first<{ voice_id: string }>(
    `SELECT v.voice_id
       FROM sessions s
       JOIN scenarios sc ON sc.id = s.scenario_id
       JOIN characters c ON c.id = sc.character_id
       JOIN elevenlabs_voices v ON v.id = c.elevenlabs_voice_id
      WHERE s.id = ?`,
    [sessionId],
  );
  const id = row?.voice_id?.trim();
  return id || null;
}

/** Fallback voice when there's no session — prefers a free voice. */
export async function defaultVoiceId(): Promise<string | null> {
  const db = await getDb();
  const row = await db.first<{ voice_id: string }>(
    "SELECT voice_id FROM elevenlabs_voices ORDER BY is_free DESC, id ASC LIMIT 1",
  );
  const id = row?.voice_id?.trim();
  return id || null;
}

async function sessionStudentId(sessionId: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.first<{ user_student_id: string | null }>(
    "SELECT user_student_id FROM sessions WHERE id = ?",
    [sessionId],
  );
  return row?.user_student_id ?? null;
}

async function sessionCharacterId(sessionId: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.first<{ character_id: string }>(
    `SELECT sc.character_id AS character_id
       FROM sessions s
       JOIN scenarios sc ON sc.id = s.scenario_id
      WHERE s.id = ?`,
    [sessionId],
  );
  return row?.character_id ?? null;
}

// --- writes ------------------------------------------------------------

export type SessionMode = "script" | "live";

export async function createSession(
  scenarioId: string,
  mode: SessionMode,
  userId: string,
): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.run(
    `INSERT INTO sessions (id, scenario_id, user_student_id, mode, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, scenarioId, userId, mode, now, now],
  );
  return id;
}

/** True only when the session exists AND belongs to this user. */
export async function sessionExists(
  id: string,
  userId: string,
): Promise<boolean> {
  const db = await getDb();
  return !!(await db.first(
    "SELECT 1 AS one FROM sessions WHERE id = ? AND user_student_id = ?",
    [id, userId],
  ));
}

export async function appendMessage(
  sessionId: string,
  role: MessageRole,
  content: string,
): Promise<number> {
  const db = await getDb();
  const now = Date.now();
  const userStudentId = role === "user" ? await sessionStudentId(sessionId) : null;
  const characterId = role === "model" ? await sessionCharacterId(sessionId) : null;
  const result = await db.run(
    `INSERT INTO messages
       (session_id, role, user_student_id, character_id, content, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, role, userStudentId, characterId, content, now],
  );
  await db.run("UPDATE sessions SET updated_at = ? WHERE id = ?", [
    now,
    sessionId,
  ]);
  return result.lastInsertRowid;
}

export async function recordCall(call: {
  sessionId: string;
  kind: CallKind;
  model: string;
  promptTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  totalTokens: number;
  latencyMs: number;
  ok: boolean;
  error?: string | null;
}): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO api_calls
       (session_id, kind, model, prompt_tokens, output_tokens,
        thought_tokens, total_tokens, latency_ms, ok, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      call.sessionId,
      call.kind,
      call.model,
      call.promptTokens,
      call.outputTokens,
      call.thoughtTokens,
      call.totalTokens,
      call.latencyMs,
      call.ok ? 1 : 0,
      call.error ?? null,
      Date.now(),
    ],
  );
}

// --- reads (all scoped by userId) --------------------------------------

export async function getHistory(
  sessionId: string,
  userId: string,
  limit = 40,
): Promise<StoredMessage[]> {
  const db = await getDb();
  return db.all<StoredMessage>(
    `SELECT * FROM (
       SELECT m.* FROM messages m
       JOIN sessions s ON s.id = m.session_id
       WHERE m.session_id = ? AND s.user_student_id = ?
       ORDER BY m.id DESC LIMIT ?
     ) ORDER BY id ASC`,
    [sessionId, userId, limit],
  );
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

export async function getTotals(
  userId: string,
  kind?: CallKind,
): Promise<UsageTotals> {
  const db = await getDb();
  const row = await db.first<UsageTotals>(
    `SELECT
       COUNT(*)                                AS calls,
       COUNT(DISTINCT c.session_id)            AS sessions,
       COALESCE(SUM(c.prompt_tokens), 0)       AS prompt_tokens,
       COALESCE(SUM(c.output_tokens), 0)       AS output_tokens,
       COALESCE(SUM(c.thought_tokens), 0)      AS thought_tokens,
       COALESCE(SUM(c.total_tokens), 0)        AS total_tokens,
       COALESCE(CAST(AVG(c.latency_ms) AS INTEGER), 0) AS avg_latency,
       COALESCE(SUM(CASE WHEN c.ok = 0 THEN 1 ELSE 0 END), 0) AS failures
     FROM api_calls c
     JOIN sessions s ON s.id = c.session_id
     WHERE s.user_student_id = ? AND (? IS NULL OR c.kind = ?)`,
    [userId, kind ?? null, kind ?? null],
  );
  return (
    row ?? {
      calls: 0,
      sessions: 0,
      prompt_tokens: 0,
      output_tokens: 0,
      thought_tokens: 0,
      total_tokens: 0,
      avg_latency: 0,
      failures: 0,
    }
  );
}

export type ScenarioUsage = {
  scenario_id: string;
  calls: number;
  sessions: number;
  total_tokens: number;
  prompt_tokens: number;
  output_tokens: number;
};

export async function getUsageByScenario(
  userId: string,
): Promise<ScenarioUsage[]> {
  const db = await getDb();
  return db.all<ScenarioUsage>(
    `SELECT s.scenario_id,
            COUNT(*)                     AS calls,
            COUNT(DISTINCT c.session_id) AS sessions,
            COALESCE(SUM(c.total_tokens), 0)  AS total_tokens,
            COALESCE(SUM(c.prompt_tokens), 0) AS prompt_tokens,
            COALESCE(SUM(c.output_tokens), 0) AS output_tokens
     FROM api_calls c
     JOIN sessions s ON s.id = c.session_id
     WHERE c.kind = 'chat' AND s.user_student_id = ?
     GROUP BY s.scenario_id
     ORDER BY total_tokens DESC`,
    [userId],
  );
}

export type DailyUsage = {
  day: string;
  calls: number;
  total_tokens: number;
};

export async function getDailyUsage(
  userId: string,
  days = 14,
): Promise<DailyUsage[]> {
  const db = await getDb();
  return db.all<DailyUsage>(
    `SELECT date(c.created_at / 1000, 'unixepoch', 'localtime') AS day,
            COUNT(*) AS calls,
            COALESCE(SUM(c.total_tokens), 0) AS total_tokens
     FROM api_calls c
     JOIN sessions s ON s.id = c.session_id
     WHERE s.user_student_id = ?
     GROUP BY day
     ORDER BY day DESC
     LIMIT ?`,
    [userId, days],
  );
}

export type SessionSummary = {
  id: string;
  scenario_id: string;
  created_at: number;
  updated_at: number;
  turns: number;
  total_tokens: number;
};

export async function getRecentSessions(
  userId: string,
  limit = 12,
): Promise<SessionSummary[]> {
  const db = await getDb();
  return db.all<SessionSummary>(
    `SELECT s.id, s.scenario_id, s.created_at, s.updated_at,
            (SELECT COUNT(*) FROM api_calls c WHERE c.session_id = s.id AND c.kind = 'chat') AS turns,
            (SELECT COALESCE(SUM(total_tokens), 0) FROM api_calls c WHERE c.session_id = s.id) AS total_tokens
     FROM sessions s
     WHERE s.user_student_id = ?
     ORDER BY s.updated_at DESC
     LIMIT ?`,
    [userId, limit],
  );
}

export async function getRecentCalls(
  userId: string,
  limit = 20,
): Promise<ApiCall[]> {
  const db = await getDb();
  return db.all<ApiCall>(
    `SELECT c.* FROM api_calls c
     JOIN sessions s ON s.id = c.session_id
     WHERE s.user_student_id = ?
     ORDER BY c.id DESC LIMIT ?`,
    [userId, limit],
  );
}

export type SessionStats = {
  calls: number;
  prompt_tokens: number;
  output_tokens: number;
  total_tokens: number;
};

export async function getSessionStats(
  sessionId: string,
  userId: string,
): Promise<SessionStats> {
  const db = await getDb();
  const row = await db.first<SessionStats>(
    `SELECT COUNT(*) AS calls,
            COALESCE(SUM(c.prompt_tokens), 0) AS prompt_tokens,
            COALESCE(SUM(c.output_tokens), 0) AS output_tokens,
            COALESCE(SUM(c.total_tokens), 0)  AS total_tokens
     FROM api_calls c
     JOIN sessions s ON s.id = c.session_id
     WHERE c.session_id = ? AND s.user_student_id = ? AND c.ok = 1 AND c.kind = 'chat'`,
    [sessionId, userId],
  );
  return (
    row ?? { calls: 0, prompt_tokens: 0, output_tokens: 0, total_tokens: 0 }
  );
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
};

/**
 * Records one outbound API call. Logging must never break a request, so
 * every failure here is swallowed after being reported to the console.
 */
export async function logApiCall(record: {
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
}): Promise<void> {
  try {
    const db = await getDb();
    const studentId = record.sessionId
      ? await sessionStudentId(record.sessionId)
      : null;
    await db.run(
      `INSERT INTO api_logs
         (platform, endpoint, operation, model, detail, session_id, user_student_id,
          input, output, input_tokens, output_tokens, total_tokens, status, ok, error,
          requested_at, returned_at, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.platform,
        record.endpoint,
        record.operation,
        record.model ?? null,
        record.detail ?? null,
        record.sessionId ?? null,
        studentId,
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
      ],
    );
  } catch (error) {
    console.error("[api_logs] 寫入失敗：", error);
  }
}

export async function getRecentLogs(
  userId: string,
  limit = 30,
): Promise<ApiLog[]> {
  const db = await getDb();
  return db.all<ApiLog>(
    "SELECT * FROM api_logs WHERE user_student_id = ? ORDER BY id DESC LIMIT ?",
    [userId, limit],
  );
}

export type LogSummary = {
  operation: string;
  platform: string;
  calls: number;
  failures: number;
  avg_ms: number;
  total_tokens: number;
};

export async function getLogSummary(userId: string): Promise<LogSummary[]> {
  const db = await getDb();
  return db.all<LogSummary>(
    `SELECT operation, platform,
            COUNT(*) AS calls,
            COALESCE(SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END), 0) AS failures,
            COALESCE(CAST(AVG(duration_ms) AS INTEGER), 0) AS avg_ms,
            COALESCE(SUM(total_tokens), 0) AS total_tokens
     FROM api_logs
     WHERE user_student_id = ?
     GROUP BY operation, platform
     ORDER BY calls DESC`,
    [userId],
  );
}

export type LogFilter = {
  operation?: string;
  status?: "ok" | "failed";
  q?: string;
};

/** Builds the shared WHERE clause so list and count never drift apart. */
function logWhere(userId: string, filter: LogFilter) {
  const clauses: string[] = ["user_student_id = ?"];
  const params: SqlParam[] = [userId];

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
    sql: `WHERE ${clauses.join(" AND ")}`,
    params,
  };
}

export async function getLogs(
  userId: string,
  filter: LogFilter,
  limit: number,
  offset: number,
): Promise<ApiLog[]> {
  const db = await getDb();
  const { sql, params } = logWhere(userId, filter);
  return db.all<ApiLog>(
    `SELECT * FROM api_logs ${sql} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
}

export async function countLogs(
  userId: string,
  filter: LogFilter,
): Promise<number> {
  const db = await getDb();
  const { sql, params } = logWhere(userId, filter);
  const row = await db.first<{ n: number }>(
    `SELECT COUNT(*) AS n FROM api_logs ${sql}`,
    params,
  );
  return row?.n ?? 0;
}

/** Distinct operations present for this user, for building the filter row. */
export async function getLogOperations(userId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.all<{ operation: string }>(
    "SELECT DISTINCT operation FROM api_logs WHERE user_student_id = ? ORDER BY operation",
    [userId],
  );
  return rows.map((r) => r.operation);
}
