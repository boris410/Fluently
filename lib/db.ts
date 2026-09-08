import {
  CHARACTER_CATALOG,
  DEFAULT_STUDENT_ID,
  DEFAULT_STUDENT_NAME,
  DEFAULT_VOICE_ID,
  DEFAULT_VOICE_LABEL,
  DEFAULT_VOICE_ROW_ID,
  SCENE_CATALOG,
  scenarios as scenarioCatalog,
  type Level,
  type RoleType,
  type Scenario,
} from "@/lib/scenarios";

/**
 * Data layer. Server-only — never import this from a Client Component.
 *
 * Two drivers behind one async interface:
 *   - Production / `npm run preview` (Cloudflare Workers): D1 via
 *     `getCloudflareContext().env.DB`.
 *   - `next dev` (plain Node): `node:sqlite` file at `data/fluently.db`
 *     (gitignored). `node:sqlite` ships with Node 22+.
 *
 * D1's API is async, so every exported function returns a Promise. The SQL
 * is portable — D1 is SQLite — so both drivers share the same statements.
 * `node:sqlite` is imported dynamically so it never reaches the Workers
 * bundle (which has no such module).
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

type NodeDb = import("node:sqlite").DatabaseSync;

function nodeAdapter(db: NodeDb): Db {
  return {
    async all(sql, params = []) {
      return db.prepare(sql).all(...params) as never;
    },
    async first(sql, params = []) {
      return (db.prepare(sql).get(...params) ?? undefined) as never;
    },
    async run(sql, params = []) {
      const res = db.prepare(sql).run(...params);
      return { lastInsertRowid: Number(res.lastInsertRowid) };
    },
  };
}

// --- node:sqlite bootstrap (dev only) ----------------------------------

const SCHEMA = `
CREATE TABLE IF NOT EXISTS user_students (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scenes (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  title_zh   TEXT NOT NULL,
  emoji      TEXT NOT NULL,
  tint_light TEXT NOT NULL,
  tint_dark  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS elevenlabs_voices (
  id       TEXT PRIMARY KEY,
  voice_id TEXT NOT NULL,
  label    TEXT NOT NULL,
  is_free  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS characters (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  elevenlabs_voice_id TEXT NOT NULL REFERENCES elevenlabs_voices(id)
);

CREATE TABLE IF NOT EXISTS scenarios (
  id           TEXT PRIMARY KEY,
  scene_id     TEXT NOT NULL REFERENCES scenes(id),
  character_id TEXT NOT NULL REFERENCES characters(id),
  role_type    TEXT NOT NULL CHECK (role_type IN ('staff', 'friend', 'boss')),
  title        TEXT NOT NULL,
  title_zh     TEXT NOT NULL,
  blurb        TEXT NOT NULL,
  level        TEXT NOT NULL,
  focus        TEXT NOT NULL,
  opening      TEXT NOT NULL,
  persona      TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  id              TEXT PRIMARY KEY,
  scenario_id     TEXT NOT NULL,
  user_student_id TEXT,
  mode            TEXT NOT NULL DEFAULT 'script',
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'model')),
  user_student_id TEXT,
  character_id    TEXT,
  content         TEXT NOT NULL,
  created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS api_calls (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id     TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL DEFAULT 'chat',
  model          TEXT NOT NULL,
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
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  platform        TEXT NOT NULL,
  endpoint        TEXT NOT NULL,
  operation       TEXT NOT NULL,
  model           TEXT,
  detail          TEXT,
  session_id      TEXT,
  user_student_id TEXT,
  input           TEXT,
  output          TEXT,
  input_tokens    INTEGER NOT NULL DEFAULT 0,
  output_tokens   INTEGER NOT NULL DEFAULT 0,
  total_tokens    INTEGER NOT NULL DEFAULT 0,
  status          INTEGER NOT NULL DEFAULT 0,
  ok              INTEGER NOT NULL DEFAULT 0,
  error           TEXT,
  requested_at    INTEGER NOT NULL,
  returned_at     INTEGER NOT NULL,
  duration_ms     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, id);
CREATE INDEX IF NOT EXISTS idx_calls_session ON api_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_calls_created ON api_calls(created_at);
CREATE INDEX IF NOT EXISTS idx_calls_kind ON api_calls(kind);
CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(user_student_id);
CREATE INDEX IF NOT EXISTS idx_logs_requested ON api_logs(requested_at);
CREATE INDEX IF NOT EXISTS idx_logs_operation ON api_logs(operation);
CREATE INDEX IF NOT EXISTS idx_scenarios_scene ON scenarios(scene_id);
`;

function nodeColumns(db: NodeDb, table: string): string[] {
  return (
    db.prepare(`PRAGMA table_info(${table})`).all() as unknown as {
      name: string;
    }[]
  ).map((c) => c.name);
}

/** Forward-migrates an older dev database in place. */
function nodeMigrate(db: NodeDb) {
  db.exec("DROP TABLE IF EXISTS roles");
  if (!nodeColumns(db, "elevenlabs_voices").includes("is_free")) {
    db.exec(
      "ALTER TABLE elevenlabs_voices ADD COLUMN is_free INTEGER NOT NULL DEFAULT 0",
    );
  }
  const scenarioCols = nodeColumns(db, "scenarios");
  if (!scenarioCols.includes("persona")) {
    db.exec("ALTER TABLE scenarios ADD COLUMN persona TEXT NOT NULL DEFAULT ''");
  }
  if (!scenarioCols.includes("character_id")) {
    db.exec("ALTER TABLE scenarios ADD COLUMN character_id TEXT NOT NULL DEFAULT 'bella'");
  }
  if (!scenarioCols.includes("role_type")) {
    db.exec("ALTER TABLE scenarios ADD COLUMN role_type TEXT NOT NULL DEFAULT 'staff'");
  }
}

function nodeSeed(db: NodeDb) {
  const now = Date.now();

  db.prepare(
    `INSERT INTO user_students (id, name, created_at, updated_at)
     VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
  ).run(DEFAULT_STUDENT_ID, DEFAULT_STUDENT_NAME, now, now);

  db.prepare(
    `INSERT INTO elevenlabs_voices (id, voice_id, label, is_free)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(id) DO UPDATE SET
       voice_id = excluded.voice_id, label = excluded.label, is_free = excluded.is_free`,
  ).run(DEFAULT_VOICE_ROW_ID, DEFAULT_VOICE_ID, DEFAULT_VOICE_LABEL);

  for (const c of CHARACTER_CATALOG) {
    db.prepare(
      `INSERT INTO characters (id, name, elevenlabs_voice_id)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, elevenlabs_voice_id = excluded.elevenlabs_voice_id`,
    ).run(c.id, c.name, DEFAULT_VOICE_ROW_ID);
  }

  for (const s of SCENE_CATALOG) {
    db.prepare(
      `INSERT INTO scenes (id, title, title_zh, emoji, tint_light, tint_dark)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title, title_zh = excluded.title_zh, emoji = excluded.emoji,
         tint_light = excluded.tint_light, tint_dark = excluded.tint_dark`,
    ).run(s.id, s.title, s.titleZh, s.emoji, s.tint[0], s.tint[1]);
  }

  scenarioCatalog.forEach((sc, index) => {
    db.prepare(
      `INSERT INTO scenarios
         (id, scene_id, character_id, role_type, title, title_zh, blurb, level, focus, opening, persona, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         scene_id = excluded.scene_id, character_id = excluded.character_id,
         role_type = excluded.role_type, title = excluded.title, title_zh = excluded.title_zh,
         blurb = excluded.blurb, level = excluded.level, focus = excluded.focus,
         opening = excluded.opening, persona = excluded.persona, sort_order = excluded.sort_order`,
    ).run(
      sc.id,
      sc.sceneId,
      sc.characterId,
      sc.roleType,
      sc.title,
      sc.titleZh,
      sc.blurb,
      sc.level,
      JSON.stringify(sc.focus),
      sc.opening,
      sc.persona,
      index,
    );
  });
}

// --- driver selection --------------------------------------------------

const globalForDb = globalThis as unknown as { __fluentlyNodeDb?: NodeDb };

async function openNodeDb(): Promise<NodeDb> {
  if (globalForDb.__fluentlyNodeDb) return globalForDb.__fluentlyNodeDb;
  const { DatabaseSync } = await import("node:sqlite");
  const { mkdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const dir = join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(join(dir, "fluently.db"));
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);
  nodeMigrate(db);
  nodeSeed(db);
  globalForDb.__fluentlyNodeDb = db;
  return db;
}

async function getDb(): Promise<Db> {
  // On Workers this returns the D1 binding; in `next dev` it throws and we
  // fall back to node:sqlite.
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = getCloudflareContext();
    const d1 = (env as unknown as { DB?: D1DatabaseLike }).DB;
    if (d1) return d1Adapter(d1);
  } catch {
    // Not running on Cloudflare — use the local node:sqlite file.
  }
  return nodeAdapter(await openNodeDb());
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
  mode: SessionMode = "script",
  userStudentId: string = DEFAULT_STUDENT_ID,
): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.run(
    `INSERT INTO sessions (id, scenario_id, user_student_id, mode, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, scenarioId, userStudentId, mode, now, now],
  );
  return id;
}

export async function sessionExists(id: string): Promise<boolean> {
  const db = await getDb();
  return !!(await db.first("SELECT 1 AS one FROM sessions WHERE id = ?", [id]));
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

// --- reads -------------------------------------------------------------

export async function getHistory(
  sessionId: string,
  limit = 40,
): Promise<StoredMessage[]> {
  const db = await getDb();
  return db.all<StoredMessage>(
    `SELECT * FROM (
       SELECT * FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT ?
     ) ORDER BY id ASC`,
    [sessionId, limit],
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

export async function getTotals(kind?: CallKind): Promise<UsageTotals> {
  const db = await getDb();
  const row = await db.first<UsageTotals>(
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
    [kind ?? null, kind ?? null],
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

export async function getUsageByScenario(): Promise<ScenarioUsage[]> {
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
     WHERE c.kind = 'chat'
     GROUP BY s.scenario_id
     ORDER BY total_tokens DESC`,
  );
}

export type DailyUsage = {
  day: string;
  calls: number;
  total_tokens: number;
};

export async function getDailyUsage(days = 14): Promise<DailyUsage[]> {
  const db = await getDb();
  return db.all<DailyUsage>(
    `SELECT date(created_at / 1000, 'unixepoch', 'localtime') AS day,
            COUNT(*) AS calls,
            COALESCE(SUM(total_tokens), 0) AS total_tokens
     FROM api_calls
     GROUP BY day
     ORDER BY day DESC
     LIMIT ?`,
    [days],
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

export async function getRecentSessions(limit = 12): Promise<SessionSummary[]> {
  const db = await getDb();
  return db.all<SessionSummary>(
    `SELECT s.id, s.scenario_id, s.created_at, s.updated_at,
            (SELECT COUNT(*) FROM api_calls c WHERE c.session_id = s.id AND c.kind = 'chat') AS turns,
            (SELECT COALESCE(SUM(total_tokens), 0) FROM api_calls c WHERE c.session_id = s.id) AS total_tokens
     FROM sessions s
     ORDER BY s.updated_at DESC
     LIMIT ?`,
    [limit],
  );
}

export async function getRecentCalls(limit = 20): Promise<ApiCall[]> {
  const db = await getDb();
  return db.all<ApiCall>("SELECT * FROM api_calls ORDER BY id DESC LIMIT ?", [
    limit,
  ]);
}

export type SessionStats = {
  calls: number;
  prompt_tokens: number;
  output_tokens: number;
  total_tokens: number;
};

export async function getSessionStats(sessionId: string): Promise<SessionStats> {
  const db = await getDb();
  const row = await db.first<SessionStats>(
    `SELECT COUNT(*) AS calls,
            COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
            COALESCE(SUM(output_tokens), 0) AS output_tokens,
            COALESCE(SUM(total_tokens), 0)  AS total_tokens
     FROM api_calls WHERE session_id = ? AND ok = 1 AND kind = 'chat'`,
    [sessionId],
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

export async function getRecentLogs(limit = 30): Promise<ApiLog[]> {
  const db = await getDb();
  return db.all<ApiLog>("SELECT * FROM api_logs ORDER BY id DESC LIMIT ?", [
    limit,
  ]);
}

export type LogSummary = {
  operation: string;
  platform: string;
  calls: number;
  failures: number;
  avg_ms: number;
  total_tokens: number;
};

export async function getLogSummary(): Promise<LogSummary[]> {
  const db = await getDb();
  return db.all<LogSummary>(
    `SELECT operation, platform,
            COUNT(*) AS calls,
            COALESCE(SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END), 0) AS failures,
            COALESCE(CAST(AVG(duration_ms) AS INTEGER), 0) AS avg_ms,
            COALESCE(SUM(total_tokens), 0) AS total_tokens
     FROM api_logs
     GROUP BY operation, platform
     ORDER BY calls DESC`,
  );
}

export type LogFilter = {
  operation?: string;
  status?: "ok" | "failed";
  q?: string;
};

/** Builds the shared WHERE clause so list and count never drift apart. */
function logWhere(filter: LogFilter) {
  const clauses: string[] = [];
  const params: SqlParam[] = [];

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

export async function getLogs(
  filter: LogFilter,
  limit: number,
  offset: number,
): Promise<ApiLog[]> {
  const db = await getDb();
  const { sql, params } = logWhere(filter);
  return db.all<ApiLog>(
    `SELECT * FROM api_logs ${sql} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
}

export async function countLogs(filter: LogFilter): Promise<number> {
  const db = await getDb();
  const { sql, params } = logWhere(filter);
  const row = await db.first<{ n: number }>(
    `SELECT COUNT(*) AS n FROM api_logs ${sql}`,
    params,
  );
  return row?.n ?? 0;
}

/** Distinct operations present, for building the filter row. */
export async function getLogOperations(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.all<{ operation: string }>(
    "SELECT DISTINCT operation FROM api_logs ORDER BY operation",
  );
  return rows.map((r) => r.operation);
}
