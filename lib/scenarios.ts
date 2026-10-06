export type Level = "beginner" | "intermediate" | "advanced";

/** The kind of person the AI plays. Stored as `scenarios.role_type`. */
export type RoleType = "staff" | "friend" | "boss";

export const ROLE_TYPES: { id: RoleType; label: string }[] = [
  { id: "staff", label: "工作人員" },
  { id: "friend", label: "朋友" },
  { id: "boss", label: "主管" },
];

export type Scenario = {
  id: string;
  emoji: string;
  title: string;
  titleZh: string;
  blurb: string;
  level: Level;
  /** The kind of role the tutor plays (staff / friend / boss). */
  roleType: RoleType;
  /** Who the tutor plays. Fed into the Gemini system instruction. */
  persona: string;
  /** Language goals the tutor will steer the conversation towards. */
  focus: string[];
  /** The tutor's opening line once a session starts. */
  opening: string;
  /** English end-intent for the model only; not shown on UI. */
  endGoal: string;
  /** English closing-intent for the judge only; not shown on UI. */
  closingIntent: string;
  /** Card wash colour, light / dark. */
  tint: [string, string];
};

/** User-turn cap for auto incomplete wrap-up. Opening model line does not count. */
export const MAX_USER_TURNS = 12;

/** Seed ids — stable, used as D1 primary keys. */
/** Row id of the single seeded ElevenLabs voice (Bella). */
export const DEFAULT_VOICE_ROW_ID = "bella";
export const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
export const DEFAULT_VOICE_LABEL = "Bella";

export type SceneCatalog = {
  id: string;
  title: string;
  titleZh: string;
  emoji: string;
  tint: [string, string];
};

export const SCENE_CATALOG: SceneCatalog[] = [
  { id: "cafe", title: "Cafe", titleZh: "咖啡店", emoji: "☕", tint: ["#f3e7d8", "#3a2f24"] },
  { id: "street", title: "Street", titleZh: "街頭", emoji: "🧭", tint: ["#dfeae0", "#243329"] },
  { id: "party", title: "Party", titleZh: "派對", emoji: "💬", tint: ["#e6e3f2", "#2b2937"] },
  { id: "hotel", title: "Hotel", titleZh: "飯店", emoji: "🏨", tint: ["#dee7f0", "#232c36"] },
  { id: "clinic", title: "Clinic", titleZh: "診所", emoji: "🩺", tint: ["#f0dfe2", "#372529"] },
  { id: "phone", title: "Phone", titleZh: "電話", emoji: "📞", tint: ["#e9e4d6", "#332f24"] },
  { id: "workplace", title: "Workplace", titleZh: "職場", emoji: "💼", tint: ["#e2e6ea", "#262b2f"] },
  { id: "forum", title: "Forum", titleZh: "論壇", emoji: "⚖️", tint: ["#efe2d3", "#372c22"] },
];

export type CharacterCatalog = { id: string; name: string };

/** Only Bella for now; every scenario is voiced by her. */
export const CHARACTER_CATALOG: CharacterCatalog[] = [{ id: "bella", name: "Bella" }];

export type ScenarioCatalog = Scenario & {
  sceneId: string;
  characterId: string;
};

export const LEVELS: { id: Level; label: string; en: string }[] = [
  { id: "beginner", label: "初級", en: "Beginner" },
  { id: "intermediate", label: "中級", en: "Intermediate" },
  { id: "advanced", label: "進階", en: "Advanced" },
];

export const levelLabel = (level: Level) =>
  LEVELS.find((l) => l.id === level) ?? LEVELS[0];

export const scenarios: ScenarioCatalog[] = [
  {
    id: "cafe",
    sceneId: "cafe",
    characterId: "bella",
    roleType: "staff",
    emoji: "☕",
    title: "Ordering Coffee",
    titleZh: "咖啡廳點餐",
    blurb: "走進街角咖啡廳，點一杯剛剛好的拿鐵，順便和店員閒聊兩句。",
    level: "beginner",
    persona: "a friendly barista at Bluebird Coffee, a small neighbourhood cafe",
    focus: ["Polite requests", "Sizes & options", "Small talk"],
    opening:
      "Hi there! Welcome to Bluebird Coffee. What can I get started for you today?",
    endGoal:
      "The scene goal is met when the learner has ordered a drink and you have confirmed the size and options or given the price.",
    closingIntent:
      "The order is settled and either person shows the interaction is finished, such as thanking, saying they will wait or find a seat, saying they are leaving, or wishing each other well. Stating the price or confirming the order alone is not a closing.",
    tint: ["#f3e7d8", "#3a2f24"],
  },
  {
    id: "directions",
    sceneId: "street",
    characterId: "bella",
    roleType: "friend",
    emoji: "🧭",
    title: "Giving Directions",
    titleZh: "街頭被問路",
    blurb: "在街頭被觀光客攔下問路，練習清楚地指路與描述方位。",
    level: "beginner",
    persona:
      "a friendly tourist who is a little lost and asks the learner for directions",
    focus: ["Giving directions", "Prepositions of place", "Landmarks"],
    opening:
      "Excuse me, sorry to bother you! I'm a bit lost — do you know how to get to the train station from here?",
    endGoal:
      "The scene goal is met when the learner has given a usable route, and you (the asker) have thanked them and are leaving.",
    closingIntent:
      "The asker shows they understood and are moving on, such as thanking, repeating the route and saying they will go, saying where they are heading next, or saying goodbye.",
    tint: ["#dfeae0", "#243329"],
  },
  {
    id: "small-talk",
    sceneId: "party",
    characterId: "bella",
    roleType: "friend",
    emoji: "💬",
    title: "Small Talk",
    titleZh: "派對被搭訕",
    blurb: "派對上有人主動來搭話，用三分鐘找出你們的共同話題。",
    level: "beginner",
    persona:
      "Sam, a friendly guest at a house party who comes over to strike up a conversation with the learner",
    focus: ["Openers", "Follow-up questions", "Ending politely"],
    opening:
      "Hey! I don't think we've met — I'm Sam. Mind if I join you? This party is pretty packed, huh?",
    endGoal:
      "The scene goal is met when you have chatted and one of you is ending the conversation politely.",
    closingIntent:
      "Either person shows the chat is winding down, such as saying they need to go, mentioning something else they have to do, saying it was nice talking, or making a final friendly remark. A short pause or a short reply is not a closing.",
    tint: ["#e6e3f2", "#2b2937"],
  },
  {
    id: "hotel",
    sceneId: "hotel",
    characterId: "bella",
    roleType: "staff",
    emoji: "🏨",
    title: "Hotel Check-in",
    titleZh: "飯店入住",
    blurb: "深夜抵達飯店，處理訂房、房型與一點點突發狀況。",
    level: "intermediate",
    persona: "the night-shift front desk clerk at The Harbour Hotel",
    focus: ["Confirming details", "Making requests", "Complaints"],
    opening:
      "Good evening, and welcome to The Harbour Hotel. Do you have a reservation with us tonight?",
    endGoal:
      "The scene goal is met when check-in details are done and the guest has a key or a room number.",
    closingIntent:
      "The check-in is complete and either person shows it is finished, such as acknowledging the key or room number, saying they will go up to the room, thanking, or saying something like enjoy your stay.",
    tint: ["#dee7f0", "#232c36"],
  },
  {
    id: "clinic",
    sceneId: "clinic",
    characterId: "bella",
    roleType: "staff",
    emoji: "🩺",
    title: "At the Clinic",
    titleZh: "看診問診",
    blurb: "向醫生描述症狀、聽懂醫囑，並問清楚該注意什麼。",
    level: "intermediate",
    persona: "a general practitioner seeing a patient at a walk-in clinic",
    focus: ["Describing symptoms", "Duration & frequency", "Instructions"],
    opening: "Hello, come on in and have a seat. So, what brings you in today?",
    endGoal:
      "The scene goal is met when the learner has described their symptoms and you have given advice or a next step.",
    closingIntent:
      "The advice is understood and either person shows the visit is finished, such as confirming what to do, saying they will follow the advice, thanking, or the doctor saying to come back if it does not get better and the learner agreeing.",
    tint: ["#f0dfe2", "#372529"],
  },
  {
    id: "phone-interview",
    sceneId: "phone",
    characterId: "bella",
    roleType: "boss",
    emoji: "📞",
    title: "Phone Interview",
    titleZh: "電話面試",
    blurb: "接到招募人員來電，在看不到表情的情況下完成第一輪電話面試。",
    level: "intermediate",
    persona: "a recruiter conducting a first-round phone interview with the learner",
    focus: ["Phone etiquette", "Self-introduction", "Asking to repeat"],
    opening:
      "Hi, thanks for taking my call! Is now still a good time for a quick phone interview?",
    endGoal:
      "The scene goal is met when you (the recruiter) are wrapping up the call or have said you will follow up.",
    closingIntent:
      "The recruiter starts wrapping up, such as explaining next steps, saying they will follow up, asking if there are any final questions, and the learner has nothing more to add, thanks them, or says goodbye.",
    tint: ["#e9e4d6", "#332f24"],
  },
  {
    id: "interview",
    sceneId: "workplace",
    characterId: "bella",
    roleType: "boss",
    emoji: "💼",
    title: "Job Interview",
    titleZh: "面試現場",
    blurb: "面對面試官，講出你的經歷、強項，還有那個經典的難題。",
    level: "advanced",
    persona:
      "a hiring manager interviewing the learner in person for a role on the team",
    focus: ["Self-introduction", "STAR answers", "Asking back"],
    opening:
      "Thanks for coming in today. To get us started — could you walk me through your background?",
    endGoal:
      "The scene goal is met when the interview questions are done and either the learner has asked something back or you have said you will be in touch.",
    closingIntent:
      "The interview moves into its last part, such as final questions from both sides, next steps, saying they will be in touch, thanking each other, or saying there is nothing more to add.",
    tint: ["#e2e6ea", "#262b2f"],
  },
  {
    id: "debate",
    sceneId: "forum",
    characterId: "bella",
    roleType: "friend",
    emoji: "⚖️",
    title: "Opinion & Debate",
    titleZh: "環保辯論",
    blurb: "挑一個環保爭議題目，練習把立場說得有邏輯又有風度。",
    level: "advanced",
    persona:
      "a thoughtful debate partner discussing environmental issues who takes the opposing position",
    focus: ["Stating a position", "Counter-arguments", "Hedging"],
    opening:
      "Let's dig into something timely: should single-use plastics be banned outright? Where do you stand?",
    endGoal:
      "The scene goal is met when both sides have made their case and the conversation is wrapping up.",
    closingIntent:
      "Both sides have made their points and either side wraps up, such as summing up a final point, acknowledging the other side, agreeing to disagree, saying there is nothing more to add, or ending politely. One side going quiet for a moment is not a closing.",
    tint: ["#efe2d3", "#372c22"],
  },
];
