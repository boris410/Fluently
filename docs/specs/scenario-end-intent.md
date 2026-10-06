# Spec: Scenario end-intent

- Slug: `scenario-end-intent`
- Status: draft
- Source request: 對於 情境 生命週期的 結束意圖判斷 想法是在 資料庫欄位或是情境程式碼 呼叫時候 增加結束意圖判斷 符合意圖的就讓AI產生結束回話

## Background

Fluently already has eight public scenarios ([`docs/SCENARIOS.md`](../SCENARIOS.md); do **not** invent a ninth or rename `id`s). In-scene chat is one Gemini call per learner turn ([`lib/gemini.ts`](../../lib/gemini.ts) `generateReply` + [`app/api/chat/route.ts`](../../app/api/chat/route.ts)). The tutor stays in character: 1–3 sentences and one follow-up question. A debrief exists only when the learner taps **結束對話** — that path is `POST /api/review` → in-place [`PracticeReview`](../../components/chat-room.tsx) in script, or [`LiveRoom` `finish()`](../../components/live-room.tsx) then redirect to script ([`docs/specs/post-chat-review.md`](./post-chat-review.md), [`docs/DATA.md`](../DATA.md)).

Nothing in the catalog tells the model **when the scene is done**. A cafe order can finish while the barista still asks another question. This spec adds a model-only `scenarios.end_goal` (English, not on UI), injects it into the **same** chat system instruction, and adds a required boolean `ended` on that same `generateReply` JSON. When `ended` is true, the tutor writes an in-character closing (no question), then the client runs the **existing** review flow. No second classifier call. No new secrets.

`api_calls.kind` for this turn stays `chat`. Review, if it runs, stays `kind='review'` as today.

## User stories

1. As a logged-in learner, I want the partner to close the scene in character when the situation is clearly finished, so I am not asked another question after the task is done.
2. As a logged-in learner, I want that closing line to trigger the same post-chat review as **結束對話**, so I still get 建議 / 單字 / 文法 / 句子 without tapping end.
3. As a logged-in learner in 真實情境, I want to hear the closing line, then land on the script transcript with that review (same as today’s live `finish()`).
4. As a logged-in learner, I want the conversation to continue with a question when the end goal is not clearly met or the model is unsure, so a half-done order is not scored as finished.
5. As a logged-in learner, I still want **結束對話** when I choose to stop early, with the same empty-transcript and review-error copy as today.

## Acceptance criteria

- [ ] **AC1 (catalog + migration + docs, not on UI):** Add `scenarios.end_goal TEXT NOT NULL` in `migrations/0007_scenario_end_goal.sql` only. Do **not** rewrite `0001_init.sql` / `0002_seed.sql`. SQLite `ADD COLUMN … NOT NULL` **must** include `DEFAULT ''`, then **eight** `UPDATE scenarios SET end_goal = '…' WHERE id = '…'` using the **exact** English strings in [End-goal copy](#end-goal-copy). After apply, all eight public ids have a non-empty `end_goal`. Seed the same strings on [`lib/scenarios.ts`](../../lib/scenarios.ts) as `endGoal` (add `endGoal: string` to `Scenario`). [`lib/db.ts`](../../lib/db.ts) `getScenario` / `listScenarios` `SELECT` `sc.end_goal` and hydrate `endGoal`. Same implementation commit updates [`docs/SCENARIOS.md`](../SCENARIOS.md) (field table, each scenario’s detail, §5 UI column all `—`, §7 now includes `endGoal`) and [`docs/DATA.md`](../DATA.md) (`scenarios` schema, `buildSystemInstruction` field list, `generateReply` JSON, `/api/chat` returns `ended`). `endGoal` / `end_goal` is **English for the model only**. Do **not** render it on homepage chips, `/scenarios` cards, mode picker, chat header, live stage, or review. Do **not** add a ninth scenario. Do **not** change public `id`s. No secrets in SQL, seed, logs, or this spec.

- [ ] **AC2 (same chat call + `ended` parse):** Do **not** add a Gemini call, route, or `api_calls.kind`. `generateReply` `responseSchema` adds required boolean `ended` (keep required `reply`, `emotion`). Description must say: true only when the end goal is clearly met this turn; if unsure, false. `GeminiResult` gains `ended: boolean`. Parse rules (all → treat as **not ended**, conversation continues):
  - JSON parse fail (today’s raw-text fallback): `ended = false`.
  - `ended` missing, not a boolean, or not strictly `true`: `ended = false`.
  - Chat HTTP error / empty `reply` (existing 502): unchanged; response has **no** successful `ended`; client does **not** auto-review.
  Observable: `POST /api/chat` **200** body includes `ended` (`true` or `false`). Error bodies stay `{ error, sessionId? }` with **no** requirement to send `ended`. That chat row is still `api_calls.kind = 'chat'` and `onCall.operation = 'chat'` (success or `ok=0`). Tokens still from `usageMetadata` only.

- [ ] **AC3 (system instruction: inject `endGoal`, branch reply shape):** `buildSystemInstruction(scenario)` includes `scenario.endGoal` (from D1 via `getScenario`, never from the POST body). Replace the single hard rule *「Reply with 1–3 sentences, then ask one question…」* with a branch; keep stay-in-character, English-only, no teacher correction, no score/summary, spoken-prose `reply`, and `emotion` rules.
  - **Not met / unsure:** `ended` false; 1–3 sentences **and one** follow-up question; stay in scene.
  - **Met:** `ended` true; 1–3 sentence **in-character closing**; **no** follow-up question; **no** score, summary, or grammar lesson; do not mention being an AI/tutor or the words “end goal”.
  Prompt must say: if unsure whether the goal is met, `ended` must be false. Opening line is still `scenarios.opening` (unchanged; not produced by `generateReply`, so it never sets `ended`).

- [ ] **AC4 (auto-review = existing 結束對話, after the closing line):** When `POST /api/chat` is **ok** and `ended === true`, and the session has **at least one** learner turn (same gate as today’s **結束對話**: client `turns` include `role === 'user'`; server `countUserMessages` already on `/api/review`):
  - **Script:** run the existing `requestReview(sessionId)` path. [`PracticeReview`](../../components/chat-room.tsx) appears in place. Loading copy stays **正在整理這次練習的回饋…**. Composer and **結束對話** may remain (no lock-after-review in [post-chat-review](./post-chat-review.md)).
  - **Live:** after the review **succeeds**, `router.push(/chat/{scenarioId}?session={sessionId}&mode=script)` — same as [`finish()`](../../components/live-room.tsx). Pause / close mic the same way `finish()` does before/while requesting. On review **non-OK**, stay on live and show the existing `error` well. Do **not** invent a new review UI.
  Speech timing for that closing `model` turn only (not the opening, not earlier replies):
  - **Will speak** = live `forceSpeak` **or** script `getAutoSpeak()` is on, **and** `play()` is started for that closing turn.
  - If it will speak and playback **starts**: wait until that line **finishes naturally** (`onSpeechFinished` for that turn) **then** `requestReview`.
  - If it will **not** speak, or autoplay is **blocked** (`onBlocked` / `needsGesture`): `requestReview` as soon as the reply is on screen. Do **not** wait for 「🔊 點一下開啟聲音」.
  - If the learner **stops** that closing playback (stop control / `stopSpeaking` without sending a new turn): `requestReview` then (speech is no longer playing).
  - If the learner **sends another turn** before auto-review runs: **cancel** the pending auto-review for the previous `ended` reply.
  - **Once-gate (per ended chat response):** the moment that `ended === true` reply is on screen and a review is scheduled, set a client pending / in-flight flag (or equivalent) **before** `review` is non-null and **before** the first `POST /api/review`. `review != null` and `disabled={reviewPending}` are **not** enough. Every trigger below shares that flag and may issue **at most one** `POST /api/review` for that response:
    - autoplay blocked (`onBlocked` / `needsGesture`)
    - natural `onSpeechFinished` of that closing turn
    - learner stop of that closing playback (stop control / `stopSpeaking` without a new turn)
    - live **暫停** (already `stopSpeaking()`)
    - manual **結束對話** (script `endConversation`, live `finish()` — both already `stopSpeaking()` then can `requestReview`)
  - Manual **結束對話** **cancels** any speech wait for that ended reply and uses the existing `requestReview` path **once**. If the once-gate already claimed the POST (in-flight or done), the tap must **not** POST again.

- [ ] **AC5 (no second review + failure paths):** For a **given** `ended === true` chat response, AC4’s pending / in-flight once-gate is the **primary** client guard — do **not** wait for `review != null` (it stays null until the first POST returns). Server **200** `cached: true` is a safety net only, not the client gate. If `review` is already non-null (`initialReview` or a prior successful `requestReview`) when a **later** turn also returns `ended === true`, **do not** `POST /api/review` again. Auto-review still requires at least one user turn — if that gate fails, show **至少說一句再結束，才有辦法給回饋。** and do not POST (same sentence as today; should not happen after a successful chat turn). Unauthenticated `POST /api/chat` / `POST /api/review` stay **401** `{ "error": "請先登入" }`. Empty chat text stays **400** `{ "error": "訊息是空的" }`. Unknown `scenarioId` stays **404** `{ "error": "找不到這個情境" }`. Review generate failure after auto-end uses existing copy **回饋沒有產生，請再試一次。** (live stays; script stays). Chat provider failure: existing chat `error` + `api_calls.kind='chat' ok=0`; **do not** auto-review.

## End-goal copy

Model-facing English only. Seed / `UPDATE` / `lib/scenarios.ts` `endGoal` **must** match this table (one string per public `id`). If a later edit changes wording, change migration seed, TS seed, SCENARIOS.md, and this table together.

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

## `generateReply` JSON (same call)

`generationConfig.responseMimeType = application/json`. Schema properties:

| Property | Type | Required | Notes |
|---|---|---|---|
| `reply` | string | yes | Spoken English prose (unchanged) |
| `emotion` | string enum | yes | Existing `ReplyEmotion` set (unchanged) |
| `ended` | boolean | yes | `true` only when the end goal is clearly met this turn; if unsure, `false` |

Client treats `ended === true` only. Everything else is false.

`POST /api/chat` **200** adds `ended: boolean` next to existing `sessionId`, `reply`, `emotion`, `usage`, `latencyMs`, `model`.

## Frontend / backend fields

D1 / SQL = `end_goal`. TS / JSON = `endGoal` / `ended`.

| Field | Source | Type | Notes |
|---|---|---|---|
| `scenarios.end_goal` | D1 | `TEXT NOT NULL` | Migration `0007`; default `''` only for the ALTER, then eight UPDATEs |
| `endGoal` | `Scenario` / seed | `string` | English; `hydrateScenario` maps `end_goal` → `endGoal` |
| `endGoal` | UI | not shown | Cards, mode picker, headers, stage, review: do not render |
| `systemInstruction` | `buildSystemInstruction(scenario)` | string | Must include `scenario.endGoal`; scenario from `getScenario(body.scenarioId)` as today |
| `ended` | Gemini JSON / `GeminiResult` | `boolean` | Required in schema; parse miss → `false` |
| `ended` | `POST /api/chat` 200 | `boolean` | |
| `ended` | `POST /api/chat` error | omitted | Do not auto-review |
| `api_calls.kind` | D1 (this turn) | `'chat'` | Unchanged. Auto-review uses existing `'review'` |
| `onCall.operation` | `api_logs` (this turn) | `'chat'` | Unchanged |
| `sessionId` | `POST /api/review` body | `string` | Same as **結束對話**; no new body fields |
| pending / in-flight review flag | client | boolean (or equivalent) | Set when an `ended` reply is scheduled for review, **before** `review` is non-null. Shared by block, natural finish, stop, live pause, and manual **結束對話**. **One** `POST /api/review` per ended response |
| `review` | client state | `SessionReview \| null` | If non-null, skip `POST /api/review` when a **later** turn is `ended` again. Too late to gate the same-response race |

Frontend owns: `lib/use-conversation.ts` `send` + speech wait / cancel, `components/chat-room.tsx` (in-place review already exists), `components/live-room.tsx` (reuse `finish()` redirect). Backend owns: migration, `lib/scenarios.ts` `endGoal`, `lib/db.ts`, `lib/gemini.ts` schema + instruction, `app/api/chat/route.ts` `ended`, DATA.md. SCENARIOS.md updates in the same commit as the catalog field. `lib/gemini.ts` still **must not** import the database.

## Errors

| Case | User-visible | API / log |
|---|---|---|
| Not logged in (`/api/chat` or `/api/review`) | (chat already gated) | **401** `{ "error": "請先登入" }`; no Gemini |
| No Gemini key | **還沒有 API key。打開右上角設定，貼上你的 Gemini API key。** | **401**; no new kind |
| Chat body not JSON | **請求格式錯誤** | **400** |
| Empty chat text | **訊息是空的** | **400** |
| Unknown `scenarioId` | **找不到這個情境** | **404** |
| Chat Gemini / empty reply | Existing chat `error` string | Existing status; `api_calls.kind='chat' ok=0`; **no** auto-review |
| Parse miss / non-boolean / missing `ended` | Conversation continues (reply still shown if `reply` ok) | **200** with `ended: false`; no `/api/review` |
| Model unsure / goal not met | Conversation continues with a question | `ended: false` |
| Auto-end, zero user turns | **至少說一句再結束，才有辦法給回饋。** | No `POST /api/review` |
| Same ended reply, two triggers (block + finish, pause + 結束對話, stop + 結束對話, …) | One loading state / one review | **One** `POST /api/review`; once-gate. Server `cached: true` only if a second POST slips through |
| Auto-end, review already present (later turn) | Review stays on screen (script) or live `finish()` may still redirect if review is already in memory — **do not POST** | No new `kind='review'` row |
| Auto-end, review generate fail | **回饋沒有產生，請再試一次。** | Existing review `ok=0`; live **does not** redirect |
| Client network fail on chat | **連線失敗，請確認 dev server 還在跑。** | No auto-review |
| Key / Client Secret | never shown | never in D1, `api_logs`, or `end_goal` |

## Non-goals

- No extra Gemini call or classifier. No new route, secret, or `api_calls.kind`.
- `endGoal` is not on cards, mode picker, headers, or any learner-facing copy.
- No **繼續聊** / undo after `ended`.
- Do not invent a ninth scenario or change public `id`s.
- Do not TTS the review. Do not store `ended` as a `messages` column or a new table.
- Do not lock `/api/chat` after a review (manual continue still allowed; if `ended` is true again, skip a second review POST).
- Do not add DESIGN tokens, `dark:` classes, or a new review layout.
- Do not put `.env.local`, `.dev.vars`, API keys, or Client Secrets in the spec or commit.

## Handoff

- Goal: Spec fix (produce 2) — one `POST /api/review` per ended chat response; once-gate covers block, natural finish, stop, live pause, and manual 結束對話 before `review` is non-null.
- Changes: [`docs/specs/scenario-end-intent.md`](./scenario-end-intent.md) only (AC4, AC5, fields, one errors row). Status still `draft`.
- Next Step: QA spec review pass 2 (`qa` subagent)
