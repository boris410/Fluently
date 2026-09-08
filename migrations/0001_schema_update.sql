-- 0001_schema_update: upgrade databases that were created with the old schema
-- (before the roles redesign). Runs AFTER 0001_init and BEFORE 0002_seed.
--
-- Uses the SQLite recreate-table pattern (no ALTER COLUMN / ADD COLUMN IF NOT EXISTS).
-- Safe on both old remote DBs and fresh DBs that already have the new columns.

-- Disable FK enforcement for the duration of this migration so we can
-- DROP and RENAME tables that are referenced by other tables.
PRAGMA foreign_keys = OFF;

-- 1. elevenlabs_voices: add is_free ----------------------------------------
CREATE TABLE IF NOT EXISTS elevenlabs_voices_new (
  id       TEXT PRIMARY KEY,
  voice_id TEXT NOT NULL,
  label    TEXT NOT NULL,
  is_free  INTEGER NOT NULL DEFAULT 0
);

-- Copy only columns present in both old and new schema.
-- is_free defaults to 0; 0002_seed will upsert it to 1 for Bella.
INSERT OR IGNORE INTO elevenlabs_voices_new (id, voice_id, label)
  SELECT id, voice_id, label FROM elevenlabs_voices;

DROP TABLE elevenlabs_voices;
ALTER TABLE elevenlabs_voices_new RENAME TO elevenlabs_voices;

-- 2. scenarios: add character_id, role_type, persona -----------------------
CREATE TABLE IF NOT EXISTS scenarios_new (
  id           TEXT PRIMARY KEY,
  scene_id     TEXT NOT NULL,
  character_id TEXT NOT NULL DEFAULT 'bella',
  role_type    TEXT NOT NULL DEFAULT 'staff',
  title        TEXT NOT NULL,
  title_zh     TEXT NOT NULL,
  blurb        TEXT NOT NULL,
  level        TEXT NOT NULL,
  focus        TEXT NOT NULL,
  opening      TEXT NOT NULL,
  persona      TEXT NOT NULL DEFAULT '',
  sort_order   INTEGER NOT NULL DEFAULT 0
);

-- Select only columns common to old and new schema.
-- 0002_seed will immediately upsert correct character_id / role_type / persona.
INSERT OR IGNORE INTO scenarios_new
  (id, scene_id, title, title_zh, blurb, level, focus, opening, sort_order)
  SELECT id, scene_id, title, title_zh, blurb, level, focus, opening, sort_order
  FROM scenarios;

DROP TABLE scenarios;
ALTER TABLE scenarios_new RENAME TO scenarios;

-- Re-enable FK enforcement.
PRAGMA foreign_keys = ON;
