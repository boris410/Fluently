-- 0005_agent_loop: Cursor multi-role feature-loop board.
-- Isolated from Gemini api_calls / api_logs. Scoped by user_id (= user.id).
-- No FK to "user". Turn tokens may be NULL when unknown — never 0-fill.

CREATE TABLE IF NOT EXISTS agent_runs (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL,
  source_request     TEXT NOT NULL,
  spec_slug          TEXT,
  status             TEXT NOT NULL CHECK (status IN ('running','passed','stopped')),
  latest_role        TEXT,
  latest_kind        TEXT,
  latest_review_pass INTEGER,
  latest_outcome     TEXT,
  latest_next_step   TEXT,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_turns (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id          TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('orchestrator','pm','qa','frontend','backend')),
  kind            TEXT NOT NULL CHECK (kind IN ('produce','review','fix')),
  review_pass     INTEGER NOT NULL CHECK (review_pass IN (1, 2)),
  outcome         TEXT NOT NULL CHECK (outcome IN ('pass','must-fix','stop','ok','error')),
  goal            TEXT,
  changes         TEXT,
  next_step       TEXT,
  feedback        TEXT,
  decision        TEXT,
  difficulty_kind TEXT CHECK (difficulty_kind IN ('must-fix','stop-leftover','same-file-conflict') OR difficulty_kind IS NULL),
  tokens_in       INTEGER,
  tokens_out      INTEGER,
  created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_user_updated ON agent_runs(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_turns_run ON agent_turns(run_id, id);
CREATE INDEX IF NOT EXISTS idx_agent_turns_user ON agent_turns(user_id, created_at);
