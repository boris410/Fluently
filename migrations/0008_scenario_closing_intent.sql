-- 0008_scenario_closing_intent: model-only English closing intent on scenarios.
-- DEFAULT '' is required for SQLite ADD COLUMN … NOT NULL; then eight UPDATEs.
-- Do not rewrite 0001_init.sql / 0002_seed.sql / 0007_scenario_end_goal.sql.
-- Do not change any 0007 end_goal string.

ALTER TABLE scenarios ADD COLUMN closing_intent TEXT NOT NULL DEFAULT '';

UPDATE scenarios SET closing_intent = 'The order is settled and either person shows the interaction is finished, such as thanking, saying they will wait or find a seat, saying they are leaving, or wishing each other well. Stating the price or confirming the order alone is not a closing.' WHERE id = 'cafe';
UPDATE scenarios SET closing_intent = 'The asker shows they understood and are moving on, such as thanking, repeating the route and saying they will go, saying where they are heading next, or saying goodbye.' WHERE id = 'directions';
UPDATE scenarios SET closing_intent = 'Either person shows the chat is winding down, such as saying they need to go, mentioning something else they have to do, saying it was nice talking, or making a final friendly remark. A short pause or a short reply is not a closing.' WHERE id = 'small-talk';
UPDATE scenarios SET closing_intent = 'The check-in is complete and either person shows it is finished, such as acknowledging the key or room number, saying they will go up to the room, thanking, or saying something like enjoy your stay.' WHERE id = 'hotel';
UPDATE scenarios SET closing_intent = 'The advice is understood and either person shows the visit is finished, such as confirming what to do, saying they will follow the advice, thanking, or the doctor saying to come back if it does not get better and the learner agreeing.' WHERE id = 'clinic';
UPDATE scenarios SET closing_intent = 'The recruiter starts wrapping up, such as explaining next steps, saying they will follow up, asking if there are any final questions, and the learner has nothing more to add, thanks them, or says goodbye.' WHERE id = 'phone-interview';
UPDATE scenarios SET closing_intent = 'The interview moves into its last part, such as final questions from both sides, next steps, saying they will be in touch, thanking each other, or saying there is nothing more to add.' WHERE id = 'interview';
UPDATE scenarios SET closing_intent = 'Both sides have made their points and either side wraps up, such as summing up a final point, acknowledging the other side, agreeing to disagree, saying there is nothing more to add, or ending politely. One side going quiet for a moment is not a closing.' WHERE id = 'debate';
