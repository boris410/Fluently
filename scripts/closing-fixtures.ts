export type ClosingTurn = { role: "user" | "model"; text: string };

export type ClosingFixture = {
  id: string;
  scenarioId: string;
  label: string;
  expect: { goal_met: boolean; closing: boolean };
  messages: ClosingTurn[];
};

export const CLOSING_FIXTURES: ClosingFixture[] = [
  {
    id: "cafe-settled-seat",
    scenarioId: "cafe",
    label: "Order settled + will find a seat",
    expect: { goal_met: true, closing: true },
    messages: [
      { role: "model", text: "Hi there! Welcome to Bluebird Coffee. What can I get started for you today?" },
      { role: "user", text: "A medium latte, oat milk, please." },
      { role: "model", text: "Medium oat latte. That's $4.80. Anything else?" },
      { role: "user", text: "No thanks. I'll find a seat and wait." },
    ],
  },
  {
    id: "cafe-price-addon",
    scenarioId: "cafe",
    label: "Price confirmed, barista asks add-on",
    expect: { goal_met: true, closing: false },
    messages: [
      { role: "model", text: "What can I get started for you today?" },
      { role: "user", text: "A large cappuccino, please." },
      { role: "model", text: "Large cappuccino. That's $5.20. Want a pastry with that?" },
      { role: "user", text: "Hmm, what pastries do you have?" },
    ],
  },
  {
    id: "cafe-thanks-size",
    scenarioId: "cafe",
    label: "Single thanks while barista asks size",
    expect: { goal_met: false, closing: false },
    messages: [
      { role: "model", text: "Hi there! Welcome to Bluebird Coffee. What can I get started for you today?" },
      { role: "user", text: "A latte, please." },
      { role: "model", text: "Sure. What size would you like?" },
      { role: "user", text: "Thanks." },
    ],
  },
  {
    id: "cafe-leave-before-order",
    scenarioId: "cafe",
    label: "Learner leaves before ordering",
    expect: { goal_met: false, closing: true },
    messages: [
      { role: "model", text: "Hi there! Welcome to Bluebird Coffee. What can I get started for you today?" },
      { role: "user", text: "Sorry, I have to run. Maybe next time." },
    ],
  },
  {
    id: "directions-route-leaving",
    scenarioId: "directions",
    label: "Usable route + asker thanks and is heading there",
    expect: { goal_met: true, closing: true },
    messages: [
      { role: "model", text: "Excuse me — do you know how to get to the train station from here?" },
      { role: "user", text: "Go straight two blocks, turn left at the bakery, then you'll see it." },
      { role: "model", text: "Left at the bakery — got it. Is it far?" },
      { role: "user", text: "About five minutes on foot." },
      { role: "model", text: "Perfect, thank you so much. I'm heading there now. Bye!" },
      { role: "user", text: "You're welcome. Safe trip!" },
    ],
  },
  {
    id: "directions-which-street",
    scenarioId: "directions",
    label: "Incomplete route, asker asks which street",
    expect: { goal_met: false, closing: false },
    messages: [
      { role: "model", text: "Excuse me — do you know how to get to the train station from here?" },
      { role: "user", text: "Go down this road and then turn." },
      { role: "model", text: "Turn onto which street?" },
      { role: "user", text: "I'm not sure of the name." },
    ],
  },
  {
    id: "directions-leave-no-route",
    scenarioId: "directions",
    label: "Learner leaves without a usable route",
    expect: { goal_met: false, closing: true },
    messages: [
      { role: "model", text: "Excuse me — do you know how to get to the train station from here?" },
      { role: "user", text: "Sorry, I can't help. I have to go. Goodbye." },
    ],
  },
  {
    id: "directions-okay-followup",
    scenarioId: "directions",
    label: "Short okay while the asker asks a follow-up",
    expect: { goal_met: false, closing: false },
    messages: [
      { role: "model", text: "Excuse me — do you know how to get to the train station from here?" },
      { role: "user", text: "Walk toward the big park." },
      { role: "model", text: "Okay, and after the park, do I keep going straight?" },
      { role: "user", text: "Okay." },
    ],
  },
  {
    id: "small-talk-need-to-go",
    scenarioId: "small-talk",
    label: "After some chat, someone needs to go",
    expect: { goal_met: true, closing: true },
    messages: [
      { role: "model", text: "Hey! I'm Sam. Mind if I join you?" },
      { role: "user", text: "Sure! I'm visiting from Taipei." },
      { role: "model", text: "Nice! What do you do there?" },
      { role: "user", text: "I teach English. This party is fun, but I need to head out. It was nice talking." },
    ],
  },
  {
    id: "small-talk-new-topic",
    scenarioId: "small-talk",
    label: "Mid-chat new topic question",
    expect: { goal_met: false, closing: false },
    messages: [
      { role: "model", text: "Hey! I'm Sam. Mind if I join you?" },
      { role: "user", text: "Not at all. I'm Alex." },
      { role: "model", text: "So what brought you to this party?" },
      { role: "user", text: "A coworker invited me. How about you?" },
    ],
  },
  {
    id: "small-talk-yeah-continues",
    scenarioId: "small-talk",
    label: "Short yeah / pause, partner continues",
    expect: { goal_met: false, closing: false },
    messages: [
      { role: "model", text: "Hey! I'm Sam. This party is pretty packed, huh?" },
      { role: "user", text: "Yeah." },
      { role: "model", text: "Do you know the host well?" },
      { role: "user", text: "Yeah." },
    ],
  },
  {
    id: "small-talk-leave-after-greeting",
    scenarioId: "small-talk",
    label: "Learner leaves after only a greeting",
    expect: { goal_met: false, closing: true },
    messages: [
      { role: "model", text: "Hey! I don't think we've met — I'm Sam. Mind if I join you?" },
      { role: "user", text: "Hi Sam. Sorry, I have to go. Bye." },
    ],
  },
  {
    id: "hotel-key-heading-up",
    scenarioId: "hotel",
    label: "Key or room number + heading up",
    expect: { goal_met: true, closing: true },
    messages: [
      { role: "model", text: "Good evening. Do you have a reservation with us tonight?" },
      { role: "user", text: "Yes, under Chen." },
      { role: "model", text: "I have you in room 412. Here's your key. Enjoy your stay." },
      { role: "user", text: "Thanks, I'll go up to the room now." },
    ],
  },
  {
    id: "hotel-room-extras",
    scenarioId: "hotel",
    label: "Room number given, clerk asks extras",
    expect: { goal_met: true, closing: false },
    messages: [
      { role: "model", text: "Good evening. Do you have a reservation with us tonight?" },
      { role: "user", text: "Yes, Chen, one night." },
      { role: "model", text: "You're in room 412. Would you like a late checkout or extra towels?" },
      { role: "user", text: "What time is late checkout?" },
    ],
  },
  {
    id: "hotel-thanks-id",
    scenarioId: "hotel",
    label: "Thanks while clerk still asks for ID",
    expect: { goal_met: false, closing: false },
    messages: [
      { role: "model", text: "Good evening. Do you have a reservation with us tonight?" },
      { role: "user", text: "Yes, under Chen." },
      { role: "model", text: "Great. May I see your ID, please?" },
      { role: "user", text: "Thanks." },
    ],
  },
  {
    id: "hotel-leave-early",
    scenarioId: "hotel",
    label: "Learner leaves before check-in is done",
    expect: { goal_met: false, closing: true },
    messages: [
      { role: "model", text: "Good evening, and welcome to The Harbour Hotel. Do you have a reservation with us tonight?" },
      { role: "user", text: "Sorry, I think I have the wrong hotel. I have to go. Goodbye." },
    ],
  },
  {
    id: "clinic-advice-will-follow",
    scenarioId: "clinic",
    label: "Advice understood + will follow",
    expect: { goal_met: true, closing: true },
    messages: [
      { role: "model", text: "So, what brings you in today?" },
      { role: "user", text: "I've had a sore throat and a fever for three days." },
      { role: "model", text: "Rest, drink water, and take paracetamol. Come back if it does not get better." },
      { role: "user", text: "Okay, I'll follow that. Thank you, doctor." },
    ],
  },
  {
    id: "clinic-advice-another-symptom",
    scenarioId: "clinic",
    label: "Advice given, doctor asks another symptom",
    expect: { goal_met: true, closing: false },
    messages: [
      { role: "model", text: "So, what brings you in today?" },
      { role: "user", text: "A cough and a fever since Monday." },
      { role: "model", text: "Try rest and fluids. Any chest pain when you breathe?" },
      { role: "user", text: "A little, only when I take a deep breath." },
    ],
  },
  {
    id: "clinic-thanks-duration",
    scenarioId: "clinic",
    label: "Thanks while doctor still asks duration",
    expect: { goal_met: false, closing: false },
    messages: [
      { role: "model", text: "Hello, come on in. So, what brings you in today?" },
      { role: "user", text: "My stomach hurts." },
      { role: "model", text: "How long have you had the pain?" },
      { role: "user", text: "Thanks." },
    ],
  },
  {
    id: "clinic-leave-before-symptoms",
    scenarioId: "clinic",
    label: "Learner leaves before describing symptoms",
    expect: { goal_met: false, closing: true },
    messages: [
      { role: "model", text: "Hello, come on in and have a seat. So, what brings you in today?" },
      { role: "user", text: "Sorry, I have to leave. I'll come back another day. Bye." },
    ],
  },
  {
    id: "phone-next-steps",
    scenarioId: "phone-interview",
    label: "Recruiter next steps + learner nothing more",
    expect: { goal_met: true, closing: true },
    messages: [
      { role: "model", text: "Hi, is now still a good time for a quick phone interview?" },
      { role: "user", text: "Yes. I've been a designer for five years." },
      { role: "model", text: "Great. We'll follow up by email this week. Any final questions?" },
      { role: "user", text: "No, that's all. Thanks so much. Goodbye." },
    ],
  },
  {
    id: "phone-followup-then-question",
    scenarioId: "phone-interview",
    label: "Will follow up, then another competency question",
    expect: { goal_met: true, closing: false },
    messages: [
      { role: "model", text: "Hi, is now still a good time for a quick phone interview?" },
      { role: "user", text: "Yes. I currently work in customer support." },
      { role: "model", text: "We'll follow up soon. One more thing — tell me about a hard customer you handled." },
      { role: "user", text: "There was a billing issue last month that I stayed late to fix." },
    ],
  },
  {
    id: "phone-thanks-first-q",
    scenarioId: "phone-interview",
    label: "Single thanks after the first question",
    expect: { goal_met: false, closing: false },
    messages: [
      { role: "model", text: "Hi, thanks for taking my call! Could you introduce yourself?" },
      { role: "user", text: "Thanks." },
    ],
  },
  {
    id: "phone-drop-mid-call",
    scenarioId: "phone-interview",
    label: "Learner drops mid-call",
    expect: { goal_met: false, closing: true },
    messages: [
      { role: "model", text: "Hi, is now still a good time for a quick phone interview?" },
      { role: "user", text: "Sorry, something came up. I have to go. Bye." },
    ],
  },
  {
    id: "interview-last-part",
    scenarioId: "interview",
    label: "Last-part wrap: next steps, will be in touch",
    expect: { goal_met: true, closing: true },
    messages: [
      { role: "model", text: "Could you walk me through your background?" },
      { role: "user", text: "I led a support team for three years and improved response time." },
      { role: "model", text: "Any questions for us?" },
      { role: "user", text: "What's the first project I'd work on?" },
      { role: "model", text: "A new onboarding flow. We'll be in touch this week. Thank you." },
      { role: "user", text: "Thanks, I have nothing more to add. Goodbye." },
    ],
  },
  {
    id: "interview-asked-back-continues",
    scenarioId: "interview",
    label: "Learner asked something back, interviewer continues",
    expect: { goal_met: true, closing: false },
    messages: [
      { role: "model", text: "Could you walk me through your background?" },
      { role: "user", text: "I have eight years in product. What does success look like in the first six months?" },
      { role: "model", text: "Shipping the new dashboard. Tell me about a time you missed a deadline." },
      { role: "user", text: "Last year a vendor slipped, so I cut scope and still launched." },
    ],
  },
  {
    id: "interview-thanks-first-star",
    scenarioId: "interview",
    label: "Single thanks after the first STAR",
    expect: { goal_met: false, closing: false },
    messages: [
      { role: "model", text: "Thanks for coming in. Walk me through your background?" },
      { role: "user", text: "I was a project manager at a startup." },
      { role: "model", text: "Tell me about a time you handled conflict on a team." },
      { role: "user", text: "Thanks." },
    ],
  },
  {
    id: "interview-leave-mid",
    scenarioId: "interview",
    label: "Learner leaves mid-interview",
    expect: { goal_met: false, closing: true },
    messages: [
      { role: "model", text: "Thanks for coming in today. Could you walk me through your background?" },
      { role: "user", text: "Sorry, I need to leave. Thank you for your time. Goodbye." },
    ],
  },
  {
    id: "debate-agree-disagree",
    scenarioId: "debate",
    label: "Both made points + agree to disagree",
    expect: { goal_met: true, closing: true },
    messages: [
      { role: "model", text: "Should single-use plastics be banned outright? Where do you stand?" },
      { role: "user", text: "Yes. They pollute rivers and we have alternatives." },
      { role: "model", text: "A sudden ban could hurt small shops that lack cheap options." },
      { role: "user", text: "We can phase it in. I think we'll have to agree to disagree. Nothing more to add." },
    ],
  },
  {
    id: "debate-new-counter",
    scenarioId: "debate",
    label: "Both argued, partner launches a new counter",
    expect: { goal_met: false, closing: false },
    messages: [
      { role: "model", text: "Should single-use plastics be banned outright?" },
      { role: "user", text: "Yes, because recycling rates are too low." },
      { role: "model", text: "True, but a ban could raise food waste if packaging disappears. What about medical plastics?" },
      { role: "user", text: "Medical use can be exempt, but shopping bags should go." },
    ],
  },
  {
    id: "debate-quiet-moment",
    scenarioId: "debate",
    label: "One side quiet for a moment",
    expect: { goal_met: false, closing: false },
    messages: [
      { role: "model", text: "Should single-use plastics be banned outright? Where do you stand?" },
      { role: "user", text: "I think a ban is the right move." },
      { role: "model", text: "Why? A lot of towns already have recycling." },
      { role: "user", text: "Hmm." },
    ],
  },
  {
    id: "debate-leave-after-both-argued",
    scenarioId: "debate",
    label: "Learner leaves after both have argued",
    expect: { goal_met: true, closing: true },
    messages: [
      { role: "model", text: "Should single-use plastics be banned outright?" },
      { role: "user", text: "Yes. The ocean evidence is clear." },
      { role: "model", text: "I hear that, but workers in packaging would lose jobs overnight." },
      { role: "user", text: "That's fair. I need to go. Thanks for the debate." },
    ],
  },
];
