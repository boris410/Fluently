-- 0002_seed: base data. Idempotent so re-applying is safe.
-- Learners are created on first Google sign-in (better-auth databaseHook),
-- not seeded here.

-- Voices -------------------------------------------------------------------
INSERT INTO elevenlabs_voices (id, voice_id, label, is_free)
VALUES ('bella', 'EXAVITQu4vr4xnSDxMaL', 'Bella', 1)
ON CONFLICT(id) DO UPDATE SET
  voice_id = excluded.voice_id,
  label    = excluded.label,
  is_free  = excluded.is_free;

-- Characters ---------------------------------------------------------------
INSERT INTO characters (id, name, elevenlabs_voice_id)
VALUES ('bella', 'Bella', 'bella')
ON CONFLICT(id) DO UPDATE SET
  name                = excluded.name,
  elevenlabs_voice_id = excluded.elevenlabs_voice_id;

-- Scenes -------------------------------------------------------------------
INSERT INTO scenes (id, title, title_zh, emoji, tint_light, tint_dark) VALUES
  ('cafe',      'Cafe',      '咖啡店', '☕', '#f3e7d8', '#3a2f24'),
  ('street',    'Street',    '街頭',   '🧭', '#dfeae0', '#243329'),
  ('party',     'Party',     '派對',   '💬', '#e6e3f2', '#2b2937'),
  ('hotel',     'Hotel',     '飯店',   '🏨', '#dee7f0', '#232c36'),
  ('clinic',    'Clinic',    '診所',   '🩺', '#f0dfe2', '#372529'),
  ('phone',     'Phone',     '電話',   '📞', '#e9e4d6', '#332f24'),
  ('workplace', 'Workplace', '職場',   '💼', '#e2e6ea', '#262b2f'),
  ('forum',     'Forum',     '論壇',   '⚖️', '#efe2d3', '#372c22')
ON CONFLICT(id) DO UPDATE SET
  title      = excluded.title,
  title_zh   = excluded.title_zh,
  emoji      = excluded.emoji,
  tint_light = excluded.tint_light,
  tint_dark  = excluded.tint_dark;

-- Scenarios (one per scene, all voiced by Bella) ---------------------------
INSERT INTO scenarios
  (id, scene_id, character_id, role_type, title, title_zh, blurb, level, focus, opening, persona, sort_order)
VALUES
  ('cafe', 'cafe', 'bella', 'staff',
   'Ordering Coffee', '咖啡廳點餐',
   '走進街角咖啡廳，點一杯剛剛好的拿鐵，順便和店員閒聊兩句。',
   'beginner',
   '["Polite requests","Sizes & options","Small talk"]',
   'Hi there! Welcome to Bluebird Coffee. What can I get started for you today?',
   'a friendly barista at Bluebird Coffee, a small neighbourhood cafe',
   0),

  ('directions', 'street', 'bella', 'friend',
   'Giving Directions', '街頭被問路',
   '在街頭被觀光客攔下問路，練習清楚地指路與描述方位。',
   'beginner',
   '["Giving directions","Prepositions of place","Landmarks"]',
   'Excuse me, sorry to bother you! I''m a bit lost — do you know how to get to the train station from here?',
   'a friendly tourist who is a little lost and asks the learner for directions',
   1),

  ('small-talk', 'party', 'bella', 'friend',
   'Small Talk', '派對被搭訕',
   '派對上有人主動來搭話，用三分鐘找出你們的共同話題。',
   'beginner',
   '["Openers","Follow-up questions","Ending politely"]',
   'Hey! I don''t think we''ve met — I''m Sam. Mind if I join you? This party is pretty packed, huh?',
   'Sam, a friendly guest at a house party who comes over to strike up a conversation with the learner',
   2),

  ('hotel', 'hotel', 'bella', 'staff',
   'Hotel Check-in', '飯店入住',
   '深夜抵達飯店，處理訂房、房型與一點點突發狀況。',
   'intermediate',
   '["Confirming details","Making requests","Complaints"]',
   'Good evening, and welcome to The Harbour Hotel. Do you have a reservation with us tonight?',
   'the night-shift front desk clerk at The Harbour Hotel',
   3),

  ('clinic', 'clinic', 'bella', 'staff',
   'At the Clinic', '看診問診',
   '向醫生描述症狀、聽懂醫囑，並問清楚該注意什麼。',
   'intermediate',
   '["Describing symptoms","Duration & frequency","Instructions"]',
   'Hello, come on in and have a seat. So, what brings you in today?',
   'a general practitioner seeing a patient at a walk-in clinic',
   4),

  ('phone-interview', 'phone', 'bella', 'boss',
   'Phone Interview', '電話面試',
   '接到招募人員來電，在看不到表情的情況下完成第一輪電話面試。',
   'intermediate',
   '["Phone etiquette","Self-introduction","Asking to repeat"]',
   'Hi, thanks for taking my call! Is now still a good time for a quick phone interview?',
   'a recruiter conducting a first-round phone interview with the learner',
   5),

  ('interview', 'workplace', 'bella', 'boss',
   'Job Interview', '面試現場',
   '面對面試官，講出你的經歷、強項，還有那個經典的難題。',
   'advanced',
   '["Self-introduction","STAR answers","Asking back"]',
   'Thanks for coming in today. To get us started — could you walk me through your background?',
   'a hiring manager interviewing the learner in person for a role on the team',
   6),

  ('debate', 'forum', 'bella', 'friend',
   'Opinion & Debate', '環保辯論',
   '挑一個環保爭議題目，練習把立場說得有邏輯又有風度。',
   'advanced',
   '["Stating a position","Counter-arguments","Hedging"]',
   'Let''s dig into something timely: should single-use plastics be banned outright? Where do you stand?',
   'a thoughtful debate partner discussing environmental issues who takes the opposing position',
   7)
ON CONFLICT(id) DO UPDATE SET
  scene_id     = excluded.scene_id,
  character_id = excluded.character_id,
  role_type    = excluded.role_type,
  title        = excluded.title,
  title_zh     = excluded.title_zh,
  blurb        = excluded.blurb,
  level        = excluded.level,
  focus        = excluded.focus,
  opening      = excluded.opening,
  persona      = excluded.persona,
  sort_order   = excluded.sort_order;
