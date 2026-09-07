import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { readElevenLabsVoiceId } from "@/lib/elevenlabs";
import {
  CHARACTER_CATALOG,
  DEFAULT_STUDENT_ID,
  DEFAULT_STUDENT_NAME,
  DEFAULT_VOICE_ROW_ID,
  SCENE_CATALOG,
  roleIdFor,
  scenarios as scenarioCatalog,
  type Level,
  type Scenario,
} from "@/lib/scenarios";

/**
 * Local SQLite store. Server-only — never import this from a Client
 * Component. The file lives in `data/fluently.db` (gitignored).
 *
 * `node:sqlite` ships with Node 22+; no native dependency to install.
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
  scenario_id?: string | null;
  kind: CallKind;
  model: string;
  voice?: string | null;
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
  label    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS characters (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  elevenlabs_voice_id TEXT NOT NULL REFERENCES elevenlabs_voices(id)
);

CREATE TABLE IF NOT EXISTS scenarios (
  id         TEXT PRIMARY KEY,
  scene_id   TEXT NOT NULL REFERENCES scenes(id),
  title      TEXT NOT NULL,
  title_zh   TEXT NOT NULL,
  blurb      TEXT NOT NULL,
  level      TEXT NOT NULL,
  focus      TEXT NOT NULL,
  opening    TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS roles (
  id           TEXT PRIMARY KEY,
  scenario_id  TEXT NOT NULL REFERENCES scenarios(id),
  character_id TEXT NOT NULL REFERENCES characters(id),
  title        TEXT NOT NULL,
  persona      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id               TEXT PRIMARY KEY,
  scenario_id      TEXT NOT NULL,
  user_student_id  TEXT,
  role_id          TEXT,
  mode             TEXT NOT NULL DEFAULT 'script',
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id       TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user', 'model')),
  user_student_id  TEXT,
  character_id     TEXT,
  content          TEXT NOT NULL,
  created_at       INTEGER NOT NULL
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
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  platform         TEXT NOT NULL,
  endpoint         TEXT NOT NULL,
  operation        TEXT NOT NULL,
  model            TEXT,
  detail           TEXT,
  session_id       TEXT,
  user_student_id  TEXT,
  input            TEXT,
  output           TEXT,
  input_tokens     INTEGER NOT NULL DEFAULT 0,
  output_tokens    INTEGER NOT NULL DEFAULT 0,
  total_tokens     INTEGER NOT NULL DEFAULT 0,
  status           INTEGER NOT NULL DEFAULT 0,
  ok               INTEGER NOT NULL DEFAULT 0,
  error            TEXT,
  requested_at     INTEGER NOT NULL,
  returned_at      INTEGER NOT NULL,
  duration_ms      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, id);
CREATE INDEX IF NOT EXISTS idx_calls_session ON api_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_calls_created ON api_calls(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_requested ON api_logs(requested_at);
CREATE INDEX IF NOT EXISTS idx_logs_operation ON api_logs(operation);
CREATE INDEX IF NOT EXISTS idx_scenarios_scene ON scenarios(scene_id);
CREATE INDEX IF NOT EXISTS idx_roles_scenario ON roles(scenario_id);
`;

function columnsOf(db: DatabaseSync, table: string) {
  return (
    db.prepare(`PRAGMA table_info(${table})`).all() as unknown as {
      name: string;
    }[]
  ).map((c) => c.name);
}

function tableExists(db: DatabaseSync, table: string) {
  return !!db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table);
}

/** Adds columns introduced after a database was first created. */
function migrate(db: DatabaseSync) {
  const callColumns = columnsOf(db, "api_calls");
  if (!callColumns.includes("kind")) {
    db.exec(
      "ALTER TABLE api_calls ADD COLUMN kind TEXT NOT NULL DEFAULT 'chat'",
    );
  }
  if (!callColumns.includes("voice")) {
    db.exec("ALTER TABLE api_calls ADD COLUMN voice TEXT");
  }

  if (!columnsOf(db, "sessions").includes("mode")) {
    db.exec(
      "ALTER TABLE sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'script'",
    );
  }
  if (!columnsOf(db, "sessions").includes("user_student_id")) {
    db.exec("ALTER TABLE sessions ADD COLUMN user_student_id TEXT");
  }
  if (!columnsOf(db, "sessions").includes("role_id")) {
    db.exec("ALTER TABLE sessions ADD COLUMN role_id TEXT");
  }

  if (!columnsOf(db, "messages").includes("user_student_id")) {
    db.exec("ALTER TABLE messages ADD COLUMN user_student_id TEXT");
  }
  if (!columnsOf(db, "messages").includes("character_id")) {
    db.exec("ALTER TABLE messages ADD COLUMN character_id TEXT");
  }

  if (
    tableExists(db, "api_logs") &&
    !columnsOf(db, "api_logs").includes("user_student_id")
  ) {
    db.exec("ALTER TABLE api_logs ADD COLUMN user_student_id TEXT");
  }

  db.exec("CREATE INDEX IF NOT EXISTS idx_calls_kind ON api_calls(kind)");
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(user_student_id)",
  );
}

function seed(db: DatabaseSync) {
  const now = Date.now();
  const envVoice = readElevenLabsVoiceId() ?? "";

  db.prepare(
    `INSERT INTO user_students (id, name, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
  ).run(DEFAULT_STUDENT_ID, DEFAULT_STUDENT_NAME, now, now);

  db.prepare(
    `INSERT INTO elevenlabs_voices (id, voice_id, label)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       voice_id = CASE WHEN excluded.voice_id != '' THEN excluded.voice_id ELSE elevenlabs_voices.voice_id END,
       label = excluded.label`,
  ).run(DEFAULT_VOICE_ROW_ID, envVoice, "Default");

  for (const scene of SCENE_CATALOG) {
    db.prepare(
      `INSERT INTO scenes (id, title, title_zh, emoji, tint_light, tint_dark)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         title_zh = excluded.title_zh,
         emoji = excluded.emoji,
         tint_light = excluded.tint_light,
         tint_dark = excluded.tint_dark`,
    ).run(
      scene.id,
      scene.title,
      scene.titleZh,
      scene.emoji,
      scene.tint[0],
      scene.tint[1],
    );
  }

  for (const character of CHARACTER_CATALOG) {
    db.prepare(
      `INSERT INTO characters (id, name, elevenlabs_voice_id)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
    ).run(character.id, character.name, DEFAULT_VOICE_ROW_ID);
  }

  scenarioCatalog.forEach((scenario, index) => {
    db.prepare(
      `INSERT INTO scenarios (id, scene_id, title, title_zh, blurb, level, focus, opening, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         scene_id = excluded.scene_id,
         title = excluded.title,
         title_zh = excluded.title_zh,
         blurb = excluded.blurb,
         level = excluded.level,
         focus = excluded.focus,
         opening = excluded.opening,
         sort_order = excluded.sort_order`,
    ).run(
      scenario.id,
      scenario.sceneId,
      scenario.title,
      scenario.titleZh,
      scenario.blurb,
      scenario.level,
      JSON.stringify(scenario.focus),
      scenario.opening,
      index,
    );

    db.prepare(
      `INSERT INTO roles (id, scenario_id, character_id, title, persona)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         character_id = excluded.character_id,
         title = excluded.title,
         persona = excluded.persona`,
    ).run(
      roleIdFor(scenario.id),
      scenario.id,
      scenario.characterId,
      scenario.roleTitle,
      scenario.persona,
    );
  });
}

function backfill(db: DatabaseSync) {
  db.prepare(
    `UPDATE sessions SET user_student_id = ?
     WHERE user_student_id IS NULL OR user_student_id = ''`,
  ).run(DEFAULT_STUDENT_ID);

  db.exec(
    `UPDATE sessions SET role_id = (
       SELECT id FROM roles WHERE roles.scenario_id = sessions.scenario_id LIMIT 1
     ) WHERE role_id IS NULL OR role_id = ''`,
  );

  db.exec(
    `UPDATE messages SET user_student_id = (
       SELECT user_student_id FROM sessions WHERE sessions.id = messages.session_id
     ) WHERE role = 'user' AND (user_student_id IS NULL OR user_student_id = '')`,
  );

  db.exec(
    `UPDATE messages SET character_id = (
       SELECT roles.character_id
       FROM sessions
       JOIN roles ON roles.id = sessions.role_id
       WHERE sessions.id = messages.session_id
     ) WHERE role = 'model' AND (character_id IS NULL OR character_id = '')`,
  );
}

function open(): DatabaseSync {
  const dir = join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(join(dir, "fluently.db"));
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);
  migrate(db);
  seed(db);
  backfill(db);
  return db;
}

// Reuse across HMR reloads in dev, otherwise every edit leaks a handle.
const globalForDb = globalThis as unknown as { __fluentlyDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (!globalForDb.__fluentlyDb) globalForDb.__fluentlyDb = open();
  return globalForDb.__fluentlyDb;
}

type ScenarioRow = {
  id: string;
  title: string;
  title_zh: string;
  blurb: string;
  level: Level;
  focus: string;
  opening: string;
  emoji: string;
  tint_light: string;
  tint_dark: string;
  persona: string;
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
    persona: row.persona,
    focus,
    opening: row.opening,
    tint: [row.tint_light, row.tint_dark],
  };
}

const SCENARIO_SELECT = `
  SELECT sc.id, sc.title, sc.title_zh, sc.blurb, sc.level, sc.focus, sc.opening,
         sn.emoji, sn.tint_light, sn.tint_dark, r.persona
  FROM scenarios sc
  JOIN scenes sn ON sn.id = sc.scene_id
  JOIN roles r ON r.id = (
    SELECT id FROM roles WHERE scenario_id = sc.id LIMIT 1
  )
`;

export function listScenarios(): Scenario[] {
  return (
    getDb()
      .prepare(`${SCENARIO_SELECT} ORDER BY sc.sort_order ASC, sc.id ASC`)
      .all() as unknown as ScenarioRow[]
  ).map(hydrateScenario);
}

export function getScenario(id: string): Scenario | undefined {
  const row = getDb()
    .prepare(`${SCENARIO_SELECT} WHERE sc.id = ? LIMIT 1`)
    .get(id) as ScenarioRow | undefined;
  return row ? hydrateScenario(row) : undefined;
}

export function defaultRoleId(scenarioId: string): string | null {
  const row = getDb()
    .prepare("SELECT id FROM roles WHERE scenario_id = ? LIMIT 1")
    .get(scenarioId) as { id: string } | undefined;
  return row?.id ?? null;
}

export function resolveSessionVoiceId(sessionId: string): string | null {
  const row = getDb()
    .prepare(
      `SELECT v.voice_id
       FROM sessions s
       JOIN roles r ON r.id = s.role_id
       JOIN characters c ON c.id = r.character_id
       JOIN elevenlabs_voices v ON v.id = c.elevenlabs_voice_id
       WHERE s.id = ?`,
    )
    .get(sessionId) as { voice_id: string } | undefined;
  const id = row?.voice_id?.trim();
  return id || null;
}

function sessionStudentId(sessionId: string): string | null {
  const row = getDb()
    .prepare("SELECT user_student_id FROM sessions WHERE id = ?")
    .get(sessionId) as { user_student_id: string | null } | undefined;
  return row?.user_student_id ?? null;
}

function sessionCharacterId(sessionId: string): string | null {
  const row = getDb()
    .prepare(
      `SELECT r.character_id AS character_id
       FROM sessions s
       JOIN roles r ON r.id = s.role_id
       WHERE s.id = ?`,
    )
    .get(sessionId) as { character_id: string } | undefined;
  return row?.character_id ?? null;
}

// --- writes ------------------------------------------------------------

export type SessionMode = "script" | "live";

export function createSession(
  scenarioId: string,
  mode: SessionMode = "script",
  userStudentId: string = DEFAULT_STUDENT_ID,
): string {
  const id = crypto.randomUUID();
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO sessions (id, scenario_id, user_student_id, role_id, mode, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      scenarioId,
      userStudentId,
      defaultRoleId(scenarioId),
      mode,
      now,
      now,
    );
  return id;
}

export function sessionExists(id: string): boolean {
  return !!getDb().prepare("SELECT 1 FROM sessions WHERE id = ?").get(id);
}

export function appendMessage(
  sessionId: string,
  role: MessageRole,
  content: string,
): number {
  const now = Date.now();
  const db = getDb();
  const userStudentId = role === "user" ? sessionStudentId(sessionId) : null;
  const characterId = role === "model" ? sessionCharacterId(sessionId) : null;
  const result = db
    .prepare(
      `INSERT INTO messages
        (session_id, role, user_student_id, character_id, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(sessionId, role, userStudentId, characterId, content, now);
  db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(
    now,
    sessionId,
  );
  return Number(result.lastInsertRowid);
}

export function recordCall(call: {
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
}) {
  const db = getDb();
  const cols = columnsOf(db, "api_calls");
  const hasLegacy = cols.includes("scenario_id");

  if (hasLegacy) {
    const session = db
      .prepare("SELECT scenario_id FROM sessions WHERE id = ?")
      .get(call.sessionId) as { scenario_id: string } | undefined;
    db.prepare(
      `INSERT INTO api_calls
        (session_id, scenario_id, kind, model, voice, prompt_tokens, output_tokens,
         thought_tokens, total_tokens, latency_ms, ok, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      call.sessionId,
      session?.scenario_id ?? "",
      call.kind,
      call.model,
      null,
      call.promptTokens,
      call.outputTokens,
      call.thoughtTokens,
      call.totalTokens,
      call.latencyMs,
      call.ok ? 1 : 0,
      call.error ?? null,
      Date.now(),
    );
    return;
  }

  db.prepare(
    `INSERT INTO api_calls
      (session_id, kind, model, prompt_tokens, output_tokens,
       thought_tokens, total_tokens, latency_ms, ok, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
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
      `SELECT s.scenario_id,
              COUNT(*)                   AS calls,
              COUNT(DISTINCT c.session_id) AS sessions,
              COALESCE(SUM(c.total_tokens), 0)  AS total_tokens,
              COALESCE(SUM(c.prompt_tokens), 0) AS prompt_tokens,
              COALESCE(SUM(c.output_tokens), 0) AS output_tokens
       FROM api_calls c
       JOIN sessions s ON s.id = c.session_id
       WHERE c.kind = 'chat'
       GROUP BY s.scenario_id
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
    const studentId = record.sessionId
      ? sessionStudentId(record.sessionId)
      : null;
    getDb()
      .prepare(
        `INSERT INTO api_logs
          (platform, endpoint, operation, model, detail, session_id, user_student_id,
           input, output, input_tokens, output_tokens, total_tokens, status, ok, error,
           requested_at, returned_at, duration_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
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
    .prepare(`SELECT * FROM api_logs ${sql} ORDER BY id DESC LIMIT ? OFFSET ?`)
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
