-- 0009_session_review_outcome: how a practice session ended.
-- DEFAULT 'manual' for existing rows. Do not rebuild 0006_session_reviews.sql.

ALTER TABLE session_reviews ADD COLUMN outcome TEXT NOT NULL DEFAULT 'manual';
