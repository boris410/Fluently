# Spec: Closing intent

- Slug: `closing-intent`
- Status: draft
- Source request: Add closingIntent to all 8 public scenarios; separate judge call; do not change any existing endGoal/end_goal wording.

## Background

Fluently has **eight** public scenarios ([`docs/SCENARIOS.md`](../SCENARIOS.md)). Do **not** invent a ninth or rename public `id`s. In-scene chat is [`lib/gemini.ts`](../../lib/gemini.ts) `generateReply` + [`app/api/chat/route.ts`](../../app/api/chat/route.ts). A debrief is [`POST /api/review`](../../app/api/review/route.ts) → in-place [`PracticeReview`](../../components/chat-room.tsx) in script, or live `finish()` then redirect to script ([`docs/specs/post-chat-review.md`](./post-chat-review.md)).

[`docs/specs/scenario-end-intent.md`](./scenario-end-intent.md) added `scenarios.end_goal` and a **same-call** boolean `ended` on `generateReply`. That contract is **replaced** by this spec. Implementers **must** remove `ended` from `generateReply`, `GeminiResult`, and `POST /api/chat` **200**. Do **not** keep both `ended` and `wrapUp`. Do **not** change any `0007` / seed `end_goal` / `endGoal` string — those stay as **task direction** for roleplay and as the judge’s `goal_met` text.

Same-call `ended` mixed “task done” with “someone is leaving,” so a price or a short thanks could close the scene while the partner still had a question. This spec splits that into two model-only English fields (`endGoal` unchanged, new `closingIntent`) and a **separate** Gemini judge **before** the roleplay reply. The conversation ends only when the judge says both are true (completed), or when someone is closing without the task (incomplete), or when the 12-turn cap hits without completed. Manual **結束對話** stays `manual`.

UI follows [`docs/DESIGN.md`](../DESIGN.md): tokens only, no hex, no `dark:`. `closingIntent` and `endGoal` are **never** rendered. No secrets, API keys, or Client Secrets in SQL, seed, logs, or this spec.

## User stories

1. As a logged-in learner, I want the partner to close in character only when the task is done **and** someone is actually finishing, so a stated price or a single thanks does not end the scene.
2. As a logged-in learner, I want a short closing and an incomplete debrief when I (or the partner) wrap up before the task is done, so I am not asked another question after I have already left.
3. As a logged-in learner, I want the same four-section [`PracticeReview`](../../components/chat-room.tsx) after an auto-close, with a title and blurb that match completed vs incomplete vs a manual **結束對話**.
4. As a logged-in learner in 真實情境, I want to hear the closing line, then land on the script transcript with that review (same as today’s live `finish()`).
5. As a logged-in learner, I want the scene to keep going with a question when only the task is done or the judge is unsure, so a half-done order is not scored as finished.
6. As a logged-in learner, I still want **結束對話** when I stop early, with the same empty-transcript and review-error copy as today.

## Acceptance criteria

- [ ] **AC1 (catalog + migration `0008` + hydrate + docs, not on UI):** Add `scenarios.closing_intent TEXT NOT NULL` in `migrations/0008_scenario_closing_intent.sql` **only**. Do **not** rewrite `0001_init.sql` / `0002_seed.sql` / `0007_scenario_end_goal.sql`. Do **not** change **any** `0007` `end_goal` string (the eight `UPDATE`s in that file stay byte-for-byte). SQLite `ADD COLUMN … NOT NULL` **must** include `DEFAULT ''`, then **eight** `UPDATE scenarios SET closing_intent = '…' WHERE id = '…'` using the **exact** English strings in [Closing-intent copy](#closing-intent-copy). After apply, all eight public ids have a non-empty `closing_intent`. Seed the same strings on [`lib/scenarios.ts`](../../lib/scenarios.ts) as `closingIntent` (add `closingIntent: string` to `Scenario`). Canonical catalog is `lib/scenarios.ts`. [`lib/db.ts`](../../lib/db.ts) `getScenario` / `listScenarios` `SELECT` `sc.closing_intent` and hydrate `closingIntent` next to existing `endGoal`. Same implementation commit updates [`docs/SCENARIOS.md`](../SCENARIOS.md) (field table, each scenario’s detail, §5 UI column for `closingIntent` all `—`, §7 judge vs roleplay) and [`docs/DATA.md`](../DATA.md) (`scenarios` schema, `0008` row, judge call, `wrapUp`, `kind='judge'`, review `outcome`). `closingIntent` / `endGoal` are **English for the model only**. Do **not** render either on homepage chips, `/scenarios` cards, mode picker, chat header, live stage, or review. Do **not** add a ninth scenario. Do **not** change public `id`s. No keyword lists in SQL, seed, prompt, or docs. No secrets.

- [ ] **AC2 (separate judge **before** roleplay):** After every **learner** turn — after the user row is appended, **before** `generateReply` — the chat route makes **one** new Gemini call (`judgeClosing` / equivalent in [`lib/gemini.ts`](../../lib/gemini.ts)). Do **not** fold the judge into `generateReply`. `lib/gemini.ts` still **must not** import the database. Scenario text comes from `getScenario(body.scenarioId)` (same as today), never from the POST body.
  - **Input:** `endGoal`, `closingIntent`, the [shared judge rule](#shared-judge-rule) **once** (not repeated per scenario), and the **last 6** `messages` rows for that session after the current user append (oldest-first; fewer than 6 → send all). Include the current learner turn. Do **not** include a model reply that has not been written yet.
  - **Output:** `generationConfig.responseMimeType = application/json` + schema required booleans `goal_met` and `closing`. Strict JSON `{"goal_met": boolean, "closing": boolean}`. A field is true only when the parsed object is valid **and** that field is strictly `true`. If **either** `goal_met` or `closing` is missing or not a boolean → treat **both** as false (so `{"closing": true}` with no `goal_met` cannot become incomplete). JSON parse fail, empty candidate, or schema-invalid → **both false**. Those miss / fail cases also write `kind='judge' ok=0`, then roleplay. Closing-only incomplete only when the model returns a valid object with `closing === true` and `goal_met === false`.
  - **Unsure:** if the model is unsure about a flag, that flag is false. Do **not** force the other flag false. (Parse / schema miss still zeros **both** — see above.)
  - **Judge by meaning**, not keywords. Do **not** add keyword lists. `goal_met` and `closing` are **independent** — see [shared judge rule](#shared-judge-rule). Do **not** tell the judge that “ending” requires the task already done.
  - **Billing:** `recordCall({ kind: "judge", ... })` and `onCall.operation = "judge"`. `CallKind` and `ApiCallRecord.operation` gain `"judge"`. Tokens **only** from `usageMetadata` (`promptTokenCount` / `candidatesTokenCount` / `thoughtsTokenCount` / `totalTokenCount`). **Do not estimate.** Provider / network / empty / unparseable / either field missing or not a boolean → `api_calls` `ok=0` **and** treat the result as both false, then **still** run roleplay (do **not** fail the chat request solely because the judge failed).
  - **來回:** `getSessionStats`, composer 「來回」chip, `getUsageByScenario` stay `kind='chat'` only. Judge is billed like `review` / `tts`, not a dialogue round-trip. `/usage` per-scenario caption becomes **只計對話呼叫，不含語音合成、談話回饋與結束判斷。** `/logs` already lists distinct `operation`s — a `judge` row must appear after a successful learner turn (or `ok=0` on judge fail).
  - The **opening** `scenarios.opening` is not a learner turn and **never** runs the judge.
  - The in-character **closing line** produced after a wrap-up is a model message. It **must not** trigger another judge on that same `POST /api/chat`. One judge per learner POST.

- [ ] **AC3 (decision matrix + remove `ended` + `wrapUp`):** Remove `ended` from `generateReply` `responseSchema`, `GeminiResult`, and `POST /api/chat` **200**. Remove the `buildSystemInstruction` branch that sets `ended` and writes a closing when `endGoal` is met. `endGoal` **may** remain in the roleplay prompt as **task direction only** (do not ask the roleplay model to output `ended` / `goal_met` / `closing`). `POST /api/chat` **200** replaces `ended` with:

  `wrapUp: null | { outcome: "completed" | "incomplete" }`

  Server decision (evaluate **in this order** after the judge, including a both-false fallback):

  | Judge / cap | Roleplay | `wrapUp` |
  |---|---|---|
  | `goal_met === true` **and** `closing === true` | Short **in-character closing** (1–3 sentences). **No** follow-up question. **No** score, summary, or grammar lesson. Do not mention being an AI/tutor or the words “end goal” / “closing intent”. | `{ outcome: "completed" }` |
  | `goal_met === true` **and** `closing === false`, and user-turn count **&lt; 12** | **Do not end.** Normal roleplay: 1–3 sentences **and one** follow-up question. Stay in scene. | `null` |
  | `closing === true` **and** `goal_met === false` | Short in-character closing (same shape as completed). **Do not** keep pushing the task. | `{ outcome: "incomplete" }` |
  | Both false, and user-turn count **&lt; 12** | Normal roleplay with a question. | `null` |
  | User-turn count **≥ 12** and not (`goal_met` and `closing`) | Short closing; do not keep pushing. | `{ outcome: "incomplete" }` |

  Roleplay is told the reply **shape** by the route (e.g. a `closingTurn` flag into `buildSystemInstruction`), not by asking it to re-judge. Error bodies stay `{ error, sessionId? }` with **no** requirement to send `wrapUp` or `ended`. Client treats wrap-up only when `wrapUp` is an object and `outcome` is exactly `"completed"` or `"incomplete"`. Anything else (including a leftover `ended: true`) is continue.

- [ ] **AC4 (auto-review once-gate, reuse scenario-end-intent):** When `POST /api/chat` is **ok** and `wrapUp` is a completed/incomplete object, and the session has **at least one** learner turn (client `turns` include `role === 'user'`; server `countUserMessages` already on `/api/review`):
  - **Generate body:** every `requestReview` that will **generate** (auto-review, retry after 「回饋沒有產生，請再試一次。」, manual **結束對話**) must `POST /api/review` with `{ sessionId, outcome }`. Do **not** POST `{ sessionId }` alone on the generate path (that is **400** `結束方式無效` per AC5). Valid cache may omit `outcome`.
  - **Which `outcome`:** auto wrap-up sends `wrapUp.outcome` (`"completed"` or `"incomplete"`). Manual **結束對話** with **no** pending / stored wrap-up sends `"manual"`.
  - **Script:** that `requestReview` path. [`PracticeReview`](../../components/chat-room.tsx) appears in place. Loading copy stays **正在整理這次練習的回饋…**. Composer and **結束對話** may remain (no lock-after-review).
  - **Live:** after the review **succeeds**, `router.push(/chat/{scenarioId}?session={sessionId}&mode=script)` — same as [`finish()`](../../components/live-room.tsx). Pause / close mic the same way `finish()` does. On review **non-OK**, stay on live and show the existing `error` well. Do **not** invent a new review UI.
  - Speech timing for that **closing** `model` turn only (reuse [`lib/use-conversation.ts`](../../lib/use-conversation.ts) `scheduleEndedReview` / `fireEndedReview` / `reviewClaimedRef` pattern; trigger is `wrapUp` not `ended`):
    - **Will speak** = live `forceSpeak` **or** script `getAutoSpeak()` is on, **and** `play()` is started for that closing turn.
    - If it will speak and playback **starts**: wait until that line **finishes naturally** **then** `requestReview` with `{ sessionId, outcome: wrapUp.outcome }`.
    - If it will **not** speak, or autoplay is **blocked** (`onBlocked` / `needsGesture`): `requestReview` as soon as the reply is on screen, same body. Do **not** wait for 「🔊 點一下開啟聲音」.
    - If the learner **stops** that closing playback (stop control / `stopSpeaking` without sending a new turn): `requestReview` then, same stored wrap-up `outcome`.
    - **Once-gate (per wrap-up chat response):** the moment that wrap-up reply is on screen and a review is scheduled, set the pending / in-flight flag **before** `review` is non-null and **before** the first `POST /api/review`. `review != null` and `disabled={reviewPending}` are **not** enough. Every trigger below shares that flag and may issue **at most one** `POST /api/review` for that response: autoplay blocked, natural finish, learner stop, live **暫停**, manual **結束對話**.
    - If wrap-up is **pending or in-flight**, **結束對話** does **not** send a second POST (it may cancel the speech wait so the already-claimed / about-to-claim request can finish). If the once-gate already claimed (in-flight or success), the tap must **not** POST again.
  - **Pending-outcome lifecycle:**
    - Store `wrapUp.outcome` when a wrap-up reply is scheduled, **before** the first review POST.
    - If the learner **sends another turn** before auto-review runs: **cancel** the pending auto-review **and clear** the stored wrap-up outcome. A later continue (`wrapUp: null`) also **clears** it. After that clear, **結束對話** sends `"manual"`.
    - Failed auto-review **without** a later turn: keep the stored wrap-up `outcome`; once-gate releases (same as today). Retry / **結束對話** resends that stored `"completed"` / `"incomplete"`, not `"manual"`.
    - After a review **succeeds**, stored wrap-up is done (do not POST again).
  - If `review` is already non-null when a **later** turn also returns `wrapUp`, **do not** `POST /api/review` again. Server **200** `cached: true` is a safety net only.

- [ ] **AC5 (review `outcome` + same PracticeReview, title/blurb only):** On the **generate** path, `POST /api/review` body is `{ sessionId, outcome }` with `outcome`: `"completed" | "incomplete" | "manual"`. Which value the client sends is AC4 (auto wrap-up → `wrapUp.outcome`; **結束對話** with no pending wrap-up → `"manual"`; retry after fail without a later turn → stored wrap-up). Canonical `SessionReview` JSON (**建議 / 單字 / 文法 / 句子**) is **unchanged** (no `outcome` inside the payload). `generateReview` / `buildReviewInstruction` do **not** take `outcome` (title/blurb are UI-only; they read API / RSC `outcome`, unreadable → `manual`).
  - Persist `session_reviews.outcome` in `migrations/0009_session_review_outcome.sql` only: `ALTER TABLE session_reviews ADD COLUMN outcome TEXT NOT NULL DEFAULT 'manual'`. Do **not** rebuild `0006`. `insertSessionReview` writes `outcome`. `getSessionReview` returns it. RSC chat page passes it into `PracticeReview`.
  - Lookup order stays [post-chat-review](./post-chat-review.md) § POST lookup (401 / 400 JSON / key → sessionId → 404 not owned → 400 zero user turns → scenario → cache). **Valid cache:** **200** `{ cached: true, review, sessionId, model, outcome }` using the **stored** outcome; ignore body `outcome` (may be omitted). **Generate path:** missing / not one of the three strings → **400** `{ "error": "結束方式無效" }`; no Gemini, no `api_calls`. Success **201** includes `outcome`.
  - Same [`PracticeReview`](../../components/chat-room.tsx) card (DESIGN card recipe, four sections, empty-section copy, **再練一次**). Change **only** the block title and lead blurb. Tokens only; no hex; no `dark:`; no new tokens. Exact copy:

  | `outcome` | Title | Blurb |
  |---|---|---|
  | `completed` | `你完成了這個情境` | `場面已經走完。下面是這次練習的建議、單字、文法與句子。` |
  | `incomplete` | `這次練習先停在這裡` | `對話已經收尾，但情境目標還沒完全達成。下面仍是這次練習的回饋。` |
  | `manual` | `這次練習的回饋` | `根據你剛才說的內容整理。家教在對話裡不會出戲糾正；這份是另外產出的回顧。` |

  Unreadable stored `outcome` (empty / unknown): display as `manual`. Do **not** render `closingIntent` or `endGoal`.

- [ ] **AC6 (max user turns = 12):** Export a shared constant `MAX_USER_TURNS = 12` (name may vary; value **must** be 12) used by the chat route. Count is `messages.role = 'user'` for that session **after** the current append (opening `model` does not count). On that request, if count **≥ 12** and the judge is not both-true, force AC3 incomplete wrap-up (short closing, `wrapUp.outcome = "incomplete"`) even when both judge flags are false or only `goal_met` is true. Both-true still wins (`completed`) at the cap. Composer is **not** locked after wrap-up; a later learner turn may run the judge again; a later `wrapUp` must **not** POST a second review (AC4).

- [ ] **AC7 (catalog test in CI; judge fixtures manual):** Add `scripts/check-scenario-catalog.ts` and `package.json` `"test"` that runs `node --test` on that file (Node 22 `--experimental-strip-types` or an equivalent that imports `lib/scenarios.ts` without a separate build). `npm test` **must** fail if: public `id`s ≠ the eight in [Closing-intent copy](#closing-intent-copy); a ninth scenario appears; any `endGoal` differs from [End-goal copy (unchanged)](#end-goal-copy-unchanged); any `closingIntent` differs from [Closing-intent copy](#closing-intent-copy); either string is empty. Do **not** call Gemini in `npm test`.
  Add `scripts/fixtures/closing-judge.json` (or one file per scenario under `scripts/fixtures/closing-judge/`) with **3–4 dialogues per public scenario** covering the labels in [Judge fixtures](#judge-fixtures), plus `scripts/run-closing-judge.ts` that calls the **same** judge prompt/schema as production and prints pass/fail vs `expect`. That script is **manual** (needs a Gemini key). Do **not** wire it to `npm test`, `npm run build`, or CI.

- [ ] **AC8 (failure paths, auth, no secrets):** Unauthenticated `POST /api/chat` / `POST /api/review` stay **401** `{ "error": "請先登入" }` (no Gemini, no judge). Empty chat text stays **400** `{ "error": "訊息是空的" }`. Unknown `scenarioId` stays **404** `{ "error": "找不到這個情境" }`. Chat body not JSON stays **400** `{ "error": "請求格式錯誤" }`. No Gemini key stays **401** with the existing key sentence. Judge fail → both false, `kind='judge' ok=0`, roleplay still runs; `wrapUp` follows AC3 on that fallback (usually `null` unless the 12-turn cap). Roleplay / empty `reply` fail: existing chat `error` + `kind='chat' ok=0`; **no** `wrapUp`; **do not** auto-review. Auto-end with zero user turns: **至少說一句再結束，才有辦法給回饋。** and no `POST /api/review`. Review generate fail after wrap-up: **回饋沒有產生，請再試一次。** (live stays; script stays). Client network fail on chat: **連線失敗，請確認 dev server 還在跑。** — no auto-review. API keys / Client Secrets never in D1, `api_logs`, `closing_intent`, `end_goal`, or this spec.

## Closing-intent copy

Model-facing English only. Migration `0008` `UPDATE` / `lib/scenarios.ts` `closingIntent` / this table **must** match (one string per public `id`). Do **not** paraphrase.

| `id` | `closing_intent` / `closingIntent` |
|---|---|
| `cafe` | The order is settled and either person shows the interaction is finished, such as thanking, saying they will wait or find a seat, saying they are leaving, or wishing each other well. Stating the price or confirming the order alone is not a closing. |
| `directions` | The asker shows they understood and are moving on, such as thanking, repeating the route and saying they will go, saying where they are heading next, or saying goodbye. |
| `small-talk` | Either person shows the chat is winding down, such as saying they need to go, mentioning something else they have to do, saying it was nice talking, or making a final friendly remark. A short pause or a short reply is not a closing. |
| `hotel` | The check-in is complete and either person shows it is finished, such as acknowledging the key or room number, saying they will go up to the room, thanking, or saying something like enjoy your stay. |
| `clinic` | The advice is understood and either person shows the visit is finished, such as confirming what to do, saying they will follow the advice, thanking, or the doctor saying to come back if it does not get better and the learner agreeing. |
| `phone-interview` | The recruiter starts wrapping up, such as explaining next steps, saying they will follow up, asking if there are any final questions, and the learner has nothing more to add, thanks them, or says goodbye. |
| `interview` | The interview moves into its last part, such as final questions from both sides, next steps, saying they will be in touch, thanking each other, or saying there is nothing more to add. |
| `debate` | Both sides have made their points and either side wraps up, such as summing up a final point, acknowledging the other side, agreeing to disagree, saying there is nothing more to add, or ending politely. One side going quiet for a moment is not a closing. |

## End-goal copy (unchanged)

Do **not** edit these strings in `0007`, `lib/scenarios.ts` `endGoal`, or `docs/SCENARIOS.md` End goal lines. Copied here so `npm test` and implementers can lock them.

| `id` | `end_goal` / `endGoal` |
|---|---|
| `cafe` | The scene goal is met when the learner has ordered a drink and you have confirmed the size and options or given the price. |
| `directions` | The scene goal is met when the learner has given a usable route, and you (the asker) have thanked them and are leaving. |
| `small-talk` | The scene goal is met when you have chatted and one of you is ending the conversation politely. |
| `hotel` | The scene goal is met when check-in details are done and the guest has a key or a room number. |
| `clinic` | The scene goal is met when the learner has described their symptoms and you have given advice or a next step. |
| `phone-interview` | The scene goal is met when you (the recruiter) are wrapping up the call or have said you will follow up. |
| `interview` | The scene goal is met when the interview questions are done and either the learner has asked something back or you have said you will be in touch. |
| `debate` | The scene goal is met when both sides have made their case and the conversation is wrapping up. |

Some `endGoal` strings already mention wrapping up (`directions`, `small-talk`, `phone-interview`, `debate`). That is **intentional leftover**. Judge `goal_met` against the text **as written**. Do **not** “fix” those sentences in this feature.

## Shared judge rule

Include this **once** in the judge system instruction (not pasted under each scenario). Do **not** add keyword lists around it. Do **not** tell the judge that the conversation is “ending” only when the task is done **and** someone is finished — that AND belongs to the **server** completed row, not to `closing`.

> Judge by meaning, not keywords. Nobody must say goodbye. `goal_met` and `closing` are independent booleans. Set `goal_met` from `endGoal` only; do not require someone to be leaving. Set `closing` from `closingIntent` only; someone leaving or finishing the interaction is enough even if the task is not done. Do not set `closing` false just because the task is unfinished. A single thanks, okay, or sure is not a closing if the other person keeps going with a new question or topic. If you are unsure about a flag, set that flag false; do not change the other flag.

**Server** (not the model) maps the pair: natural **completed** wrap-up needs **both** true; **incomplete** wrap-up is `closing` without `goal_met`.

Suggested judge generation: same model as chat (`GEMINI_MODEL` / `DEFAULT_MODEL`), `temperature` **0.2**, small `maxOutputTokens` (enough for the JSON object). Key via `resolveGeminiApiKey(request)` as `/api/chat` today. Key never in JSON body, D1, or logs.

## `POST /api/chat` 200

| Field | Type | Notes |
|---|---|---|
| `sessionId` | string | Unchanged |
| `reply` | string | Roleplay `reply` (unchanged spoken prose) |
| `emotion` | `ReplyEmotion` | Unchanged |
| `wrapUp` | `null \| { outcome: "completed" \| "incomplete" }` | Replaces `ended`. `null` = continue |
| `usage` | `GeminiUsage` | **Roleplay** call `usageMetadata` only (not the judge) |
| `latencyMs` | number | Roleplay latency |
| `model` | string | Unchanged |

Do **not** return `ended`. Composer token chip may keep adding this `usage` only (judge tokens live on `/usage` unfiltered totals + `/logs`).

## `POST /api/chat` order (one learner turn)

1. Auth / key / JSON / scenario / non-empty text (existing).
2. Create or resume session; append **user** message.
3. `getHistory` → last 6 → `judgeClosing` → `recordCall` `kind='judge'` (success or `ok=0`).
4. Decide `wrapUp` + roleplay shape (AC3 + AC6).
5. `generateReply` (no `ended`) → append **model** message → `recordCall` `kind='chat'`.
6. **200** with `wrapUp`. Roleplay failure: existing error path; judge row already written; no auto-review.

## Judge fixtures

Each public `id` needs **3–4** dialogues (last ≤ 6 turns, include a final `user` line). Labels are the **intended** `expect` for `run-closing-judge.ts`. Dialogue wording is implementation-owned; labels are not.

| `id` | Cases (expect `goal_met` / `closing`) |
|---|---|
| `cafe` | Order settled + will find a seat / thanks-and-wait (**true/true**). Price or size confirmed, barista asks a new add-on question (**true/false**). Single thanks while barista still asks size (**false/false**). Learner leaves before ordering (**false/true**). |
| `directions` | Usable route + asker thanks and is heading there (**true/true** — `endGoal` already includes thanks/leaving). Incomplete route, asker asks which street (**false/false**). Learner leaves without a usable route (**false/true**). Short “okay” while the asker asks a follow-up (**false/false**). |
| `small-talk` | After some chat, someone needs to go / nice talking (**true/true** — `endGoal` includes ending politely). Mid-chat new topic question (**false/false**). Short “yeah” / pause, partner continues (**false/false**). Learner leaves after only a greeting, no real chat (**false/true**). |
| `hotel` | Key or room number + heading up / enjoy your stay (**true/true**). Room number already given, clerk asks a new extras question (**true/false**). Thanks while clerk still asks for ID (**false/false**). Learner leaves before check-in is done (**false/true**). |
| `clinic` | Advice understood + will follow / come-back-if-not-better and learner agrees (**true/true**). Advice given, doctor asks another symptom question (**true/false**). Thanks while doctor still asks duration (**false/false**). Learner leaves before describing symptoms (**false/true**). |
| `phone-interview` | Recruiter next steps / follow-up + learner has nothing more, thanks, or goodbye (**true/true**). Recruiter said they will follow up, then asks another competency question (**true/false** — `endGoal` can be met while talk continues). Single thanks after the first question (**false/false**). Learner drops mid-call (**false/true**). |
| `interview` | Last-part wrap: final questions, next steps, will be in touch, nothing more to add (**true/true**). Questions done and learner asked something back, interviewer continues with a new question (**true/false**). Single thanks after the first STAR (**false/false**). Learner leaves mid-interview (**false/true**). |
| `debate` | Both made points + final sum-up / agree to disagree / nothing more to add (**true/true**). Both argued, partner launches a new counter (**false/false** if `endGoal` still requires wrapping up). One side quiet for a moment (**false/false**). Learner leaves after both have argued (**closing` true**; `goal_met` follows written `endGoal`). |

## Frontend / backend fields

D1 / SQL = `closing_intent`, `end_goal`, `session_reviews.outcome`. TS / JSON = `closingIntent`, `endGoal`, `wrapUp`, `goal_met`, `closing`, `outcome`.

| Field | Source | Type | Notes |
|---|---|---|---|
| `scenarios.closing_intent` | D1 | `TEXT NOT NULL` | Migration **`0008` only**; `DEFAULT ''` then eight UPDATEs |
| `scenarios.end_goal` | D1 | `TEXT NOT NULL` | **Unchanged** from `0007` |
| `closingIntent` | `Scenario` / seed | `string` | English; hydrate `closing_intent` → `closingIntent` |
| `endGoal` | `Scenario` / seed | `string` | Unchanged mapping |
| `closingIntent` / `endGoal` | UI | not shown | Cards, mode picker, headers, stage, review: do not render |
| `MAX_USER_TURNS` | shared constant | `12` | Chat route cap (AC6) |
| Judge input | `judgeClosing` | `endGoal`, `closingIntent`, shared rule, last 6 messages | From `getScenario` + `getHistory` |
| `goal_met`, `closing` | Judge JSON | `boolean` | Either missing / non-boolean, or parse / empty / schema-invalid → **both** false, `ok=0` |
| `wrapUp` | `POST /api/chat` 200 | `null \| { outcome: "completed" \| "incomplete" }` | Replaces `ended` |
| `wrapUp` / `ended` | `POST /api/chat` error | omitted | Do not auto-review |
| `api_calls.kind` | D1 (judge) | `'judge'` | Not 來回 |
| `onCall.operation` | `api_logs` (judge) | `'judge'` | |
| `api_calls.kind` | D1 (roleplay) | `'chat'` | Unchanged |
| `systemInstruction` (roleplay) | `buildSystemInstruction` | string | `endGoal` as task direction; **no** `ended` branch; closing vs question from route flag |
| `outcome` | `POST /api/review` body | `"completed" \| "incomplete" \| "manual"` | Required on generate; ignored on valid cache |
| `session_reviews.outcome` | D1 | `TEXT NOT NULL` | Migration **`0009`**; default `'manual'` |
| `outcome` | `POST /api/review` 200/201 | same union | Stored value on cache |
| `sessionId` | `POST /api/review` body | `string` | Unchanged |
| `requestReview` body | `POST /api/review` generate | `{ sessionId, outcome }` | Required on generate (AC4 / AC5). Cache may omit `outcome` |
| pending wrap-up outcome | client | `completed` / `incomplete` or none | Set on wrap-up schedule; cleared if learner sends another turn or `wrapUp: null`; kept for retry after review fail; none → **結束對話** sends `manual` |
| pending / in-flight review flag | client | boolean (or equivalent) | Same once-gate as scenario-end-intent; **one** `POST /api/review` per wrap-up response |
| PracticeReview title / blurb | UI | strings in AC5 | Only difference between outcomes |

Frontend owns: `lib/use-conversation.ts` (`wrapUp` trigger, speech wait / cancel, `requestReview` body `{ sessionId, outcome }`, pending-outcome clear-on-new-turn), `components/chat-room.tsx` (`PracticeReview` title/blurb), `components/live-room.tsx` (reuse `finish()` redirect), usage caption if that file is in frontend ownership — **usage caption is on `app/usage/page.tsx` (frontend)**. Backend owns: `0008` / `0009`, `lib/scenarios.ts` `closingIntent`, `lib/db.ts` hydrate + review outcome, `lib/gemini.ts` judge + remove `ended`, `app/api/chat/route.ts` `wrapUp`, `app/api/review/route.ts` `outcome`, `docs/DATA.md`, `scripts/check-scenario-catalog.ts`, fixtures + `run-closing-judge.ts`. `docs/SCENARIOS.md` updates in the **same commit as the catalog field**. `lib/gemini.ts` still **must not** import the database.

Same-file rule: frontend must **not** edit `lib/gemini.ts` / `app/api/**` / `migrations/**` / `lib/db.ts`. Backend must **not** edit `components/**` / `lib/use-conversation.ts` / `app/usage/page.tsx`. If a type is needed on the client, export it from `lib/gemini.ts` (already client-imported) — backend adds `wrapUp` / judge types there; frontend only imports.

## Errors

| Case | User-visible | API / log |
|---|---|---|
| Not logged in (`/api/chat` or `/api/review`) | (chat already gated) | **401** `{ "error": "請先登入" }`; no Gemini |
| No Gemini key | **還沒有 API key。打開右上角設定，貼上你的 Gemini API key。** | **401**; no judge, no chat |
| Chat body not JSON | **請求格式錯誤** | **400** |
| Empty chat text | **訊息是空的** | **400** |
| Unknown `scenarioId` | **找不到這個情境** | **404** |
| Judge HTTP / empty / parse fail / missing or non-boolean field | Conversation continues unless AC6 cap | `kind='judge' ok=0`; **both** false; roleplay still runs; `{"closing": true}` without `goal_met` is this case |
| Roleplay Gemini / empty reply | Existing chat `error` string | Existing status; `kind='chat' ok=0`; no `wrapUp`; no auto-review |
| Model unsure / only `goal_met` / both false (under cap) | Conversation continues with a question | **200** `wrapUp: null` |
| Both true | Hear/see closing; then review | **200** `wrapUp: { outcome: "completed" }` |
| `closing` only | Hear/see closing; incomplete review | **200** `wrapUp: { outcome: "incomplete" }` |
| 12th+ user turn, not both true | Short closing; incomplete review | **200** `wrapUp: { outcome: "incomplete" }` |
| Auto-end, zero user turns | **至少說一句再結束，才有辦法給回饋。** | No `POST /api/review` |
| Same wrap-up reply, two triggers | One loading state / one review | **One** `POST /api/review`; once-gate |
| Later wrap-up, review already present | Review stays (script) or live may still redirect if review is in memory — **do not POST** | No new `kind='review'` row |
| Review generate fail after wrap-up | **回饋沒有產生，請再試一次。** | Existing review `ok=0`; live **does not** redirect; once-gate releases |
| Review generate, missing / bad `outcome` | **結束方式無效** | **400**; no Gemini; no `api_calls` |
| Client network fail on chat | **連線失敗，請確認 dev server 還在跑。** | No auto-review |
| Key / Client Secret | never shown | never in D1, `api_logs`, `closing_intent`, or `end_goal` |

## Non-goals

- Do **not** keep same-call `ended` from [`scenario-end-intent`](./scenario-end-intent.md). That spec’s `ended` ACs are obsolete; follow this file.
- Do **not** change any `0007` / seed `endGoal` wording. Do **not** rewrite `0001` / `0002` / `0007`.
- Do **not** invent a ninth scenario or change public `id`s.
- Do **not** put `closingIntent` or `endGoal` on cards, headers, stage, or review body.
- Do **not** add keyword lists for goodbye / thanks / okay.
- No **繼續聊** / undo after wrap-up. No lock on `/api/chat` after a review.
- Do not TTS the review. Do not store `wrapUp` as a `messages` column.
- Do not count `judge` in 來回. Do not merge `api_calls` and `api_logs`.
- Do not add DESIGN tokens, `dark:` classes, or a new review layout (title/blurb only).
- Do not put `.env.local`, `.dev.vars`, API keys, or Client Secrets in the spec or commit.
- `run-closing-judge.ts` is not CI.

## Handoff

- Goal: Spec fix (produce 2) — independent judge flags, both-false on any field miss, and `{ sessionId, outcome }` on every review generate.
- Changes: [`docs/specs/closing-intent.md`](./closing-intent.md) only (shared rule, AC2 parse, AC4 outcome lifecycle). Status still `draft`.
- Next Step: QA spec review pass 2 (`qa` subagent)
