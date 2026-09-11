-- 0006_session_reviews: one Gemini debrief per practice session.
-- Scoped by user_student_id (= user.id). No FK to "user".
-- api_calls.kind may now be 'review'; do not rebuild api_calls (no CHECK today).

CREATE TABLE IF NOT EXISTS session_reviews (
  id               TEXT PRIMARY KEY,
  session_id       TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  user_student_id  TEXT NOT NULL,
  payload          TEXT NOT NULL,
  model            TEXT NOT NULL,
  created_at       INTEGER NOT NULL
);
