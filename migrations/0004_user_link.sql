-- 0004_user_link: drop the seed 'default' learner.
-- Real accounts are created by better-auth's databaseHook on first Google
-- sign-in, keyed by user.id (same value stored in sessions.user_student_id).
-- Only delete if nothing still points at it.

DELETE FROM user_students
 WHERE id = 'default'
   AND NOT EXISTS (
     SELECT 1 FROM sessions WHERE user_student_id = 'default'
   );
