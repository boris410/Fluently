export type Level = "beginner" | "intermediate" | "advanced";

export type Scenario = {
  id: string;
  emoji: string;
  title: string;
  titleZh: string;
  blurb: string;
  level: Level;
  /** Who the tutor plays. Fed into the Gemini system instruction. */
  persona: string;
  /** Language goals the tutor will steer the conversation towards. */
  focus: string[];
  /** The tutor's opening line once a session starts. */
  opening: string;
  /** Card wash colour, light / dark. */
  tint: [string, string];
};

export const LEVELS: { id: Level; label: string; en: string }[] = [
  { id: "beginner", label: "初級", en: "Beginner" },
  { id: "intermediate", label: "中級", en: "Intermediate" },
  { id: "advanced", label: "進階", en: "Advanced" },
];

export const levelLabel = (level: Level) =>
  LEVELS.find((l) => l.id === level) ?? LEVELS[0];

export const scenarios: Scenario[] = [
  {
    id: "cafe",
    emoji: "☕",
    title: "Ordering Coffee",
    titleZh: "咖啡廳點餐",
    blurb: "走進街角咖啡廳，點一杯剛剛好的拿鐵，順便和店員閒聊兩句。",
    level: "beginner",
    persona: "a friendly barista at Bluebird Coffee, a small neighbourhood cafe",
    focus: ["Polite requests", "Sizes & options", "Small talk"],
    opening:
      "Hi there! Welcome to Bluebird Coffee. What can I get started for you today?",
    tint: ["#f3e7d8", "#3a2f24"],
  },
  {
    id: "directions",
    emoji: "🧭",
    title: "Asking Directions",
    titleZh: "街頭問路",
    blurb: "在陌生城市迷路了，向路人問路並確認自己有沒有聽懂。",
    level: "beginner",
    persona: "a helpful local pedestrian who knows the neighbourhood well",
    focus: ["Prepositions of place", "Clarifying", "Thanking"],
    opening:
      "Sure, you look a little lost! Where are you trying to go? I know this neighborhood pretty well.",
    tint: ["#dfeae0", "#243329"],
  },
  {
    id: "small-talk",
    emoji: "💬",
    title: "Small Talk",
    titleZh: "閒聊破冰",
    blurb: "派對上遇到不認識的人，用三分鐘找出你們的共同話題。",
    level: "beginner",
    persona: "Sam, another guest at a house party who has just met the learner",
    focus: ["Openers", "Follow-up questions", "Ending politely"],
    opening:
      "Hey! I don't think we've met — I'm Sam. How do you know the host?",
    tint: ["#e6e3f2", "#2b2937"],
  },
  {
    id: "hotel",
    emoji: "🏨",
    title: "Hotel Check-in",
    titleZh: "飯店入住",
    blurb: "深夜抵達飯店，處理訂房、房型與一點點突發狀況。",
    level: "intermediate",
    persona: "the night-shift front desk clerk at The Harbour Hotel",
    focus: ["Confirming details", "Making requests", "Complaints"],
    opening:
      "Good evening, and welcome to The Harbour Hotel. Do you have a reservation with us tonight?",
    tint: ["#dee7f0", "#232c36"],
  },
  {
    id: "clinic",
    emoji: "🩺",
    title: "At the Clinic",
    titleZh: "看診就醫",
    blurb: "向醫生描述症狀、聽懂醫囑，並問清楚該注意什麼。",
    level: "intermediate",
    persona: "a general practitioner seeing a patient at a walk-in clinic",
    focus: ["Describing symptoms", "Duration & frequency", "Instructions"],
    opening:
      "Hello, come on in and have a seat. So, what brings you in today?",
    tint: ["#f0dfe2", "#372529"],
  },
  {
    id: "phone-call",
    emoji: "📞",
    title: "On the Phone",
    titleZh: "電話溝通",
    blurb: "看不到表情、聽不清楚，打一通把事情講清楚的英文電話。",
    level: "intermediate",
    persona: "Alex, a support agent at Nordwell taking a phone call",
    focus: ["Spelling out loud", "Asking to repeat", "Taking messages"],
    opening:
      "Thanks for calling Nordwell Support, this is Alex speaking. How can I help you?",
    tint: ["#e9e4d6", "#332f24"],
  },
  {
    id: "interview",
    emoji: "💼",
    title: "Job Interview",
    titleZh: "英文面試",
    blurb: "面對面試官，講出你的經歷、強項，還有那個經典的難題。",
    level: "advanced",
    persona: "a hiring manager interviewing the learner for a role on your team",
    focus: ["Self-introduction", "STAR answers", "Asking back"],
    opening:
      "Thanks for coming in today. To get us started — could you walk me through your background?",
    tint: ["#e2e6ea", "#262b2f"],
  },
  {
    id: "meeting",
    emoji: "📊",
    title: "Business Meeting",
    titleZh: "商務會議",
    blurb: "在會議上報告進度、接受追問，並禮貌地推回不合理的期待。",
    level: "advanced",
    persona: "the learner's team lead running a weekly project check-in",
    focus: ["Status updates", "Disagreeing politely", "Next steps"],
    opening:
      "Alright, let's get started. Could you give us a quick update on where the project stands?",
    tint: ["#dde8e6", "#22302e"],
  },
  {
    id: "debate",
    emoji: "⚖️",
    title: "Opinion & Debate",
    titleZh: "觀點交鋒",
    blurb: "挑一個有爭議的題目，練習把立場說得有邏輯又有風度。",
    level: "advanced",
    persona: "a thoughtful conversation partner who takes the opposing position",
    focus: ["Stating a position", "Counter-arguments", "Hedging"],
    opening:
      "Let's dig into something interesting: should companies let people work fully remote? Where do you stand?",
    tint: ["#efe2d3", "#372c22"],
  },
];

export const getScenario = (id: string) => scenarios.find((s) => s.id === id);
