-- 0007_scenario_end_goal: model-only English end-intent on scenarios.
-- DEFAULT '' is required for SQLite ADD COLUMN … NOT NULL; then eight UPDATEs.
-- Do not rewrite 0001_init.sql / 0002_seed.sql.

ALTER TABLE scenarios ADD COLUMN end_goal TEXT NOT NULL DEFAULT '';

UPDATE scenarios SET end_goal = 'The scene goal is met when the learner has ordered a drink and you have confirmed the size and options or given the price.' WHERE id = 'cafe';
UPDATE scenarios SET end_goal = 'The scene goal is met when the learner has given a usable route, and you (the asker) have thanked them and are leaving.' WHERE id = 'directions';
UPDATE scenarios SET end_goal = 'The scene goal is met when you have chatted and one of you is ending the conversation politely.' WHERE id = 'small-talk';
UPDATE scenarios SET end_goal = 'The scene goal is met when check-in details are done and the guest has a key or a room number.' WHERE id = 'hotel';
UPDATE scenarios SET end_goal = 'The scene goal is met when the learner has described their symptoms and you have given advice or a next step.' WHERE id = 'clinic';
UPDATE scenarios SET end_goal = 'The scene goal is met when you (the recruiter) are wrapping up the call or have said you will follow up.' WHERE id = 'phone-interview';
UPDATE scenarios SET end_goal = 'The scene goal is met when the interview questions are done and either the learner has asked something back or you have said you will be in touch.' WHERE id = 'interview';
UPDATE scenarios SET end_goal = 'The scene goal is met when both sides have made their case and the conversation is wrapping up.' WHERE id = 'debate';
