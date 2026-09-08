-- 0001_init: Fluently schema for D1.
-- Redesign vs the old node:sqlite schema:
--   * no `roles` table (role is a `scenarios.role_type` column)
--   * scenarios own `persona`, `character_id`, `role_type`
--   * sessions have no `role_id` (character/voice derived via scenario)
--   * elevenlabs_voices has `is_free`
--   * api_calls has no legacy `scenario_id`/`voice` columns

DROP TABLE IF EXISTS roles;

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
