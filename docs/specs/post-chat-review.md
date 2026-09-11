# Spec: Post-chat review

- Slug: `post-chat-review`
- Status: qa-diff-pass
- Source request: 來試試看一個任務，我要做 談話後的評估，會給予本次談話給予建議 單字 文法 句子 的結果於畫面

## Background

Fluently is an English speaking-practice app. After Google login, the learner picks one of **8** existing scenarios ([`docs/SCENARIOS.md`](../SCENARIOS.md); do **not** invent a ninth) and talks with an in-character Gemini tutor. Dialogue lives in D1 `sessions` / `messages`; Gemini usage lives in `api_calls` / `api_logs` ([`docs/DATA.md`](../DATA.md)). Dev and production share **one** Cloudflare D1; `node:sqlite` is retired.

The homepage already promises step **03 收下回饋** — 「對話結束給你一份重點回顧：說得好的地方、可以再更自然的講法。」([`app/page.tsx`](../../app/page.tsx) `STEPS`) — but **that step is not implemented**. In-scene chat is the opposite of a debrief: [`lib/gemini.ts`](../../lib/gemini.ts) `buildSystemInstruction()` hard-rules *「Never break the scene to give a grammar lesson, a score, or a summary.」* Assessment **must** be a **second Gemini call after the learner explicitly ends the talk**, with a different system instruction. Do **not** fold coaching into the in-scene prompt.

Today:

- **真實情境** ([`components/live-room.tsx`](../../components/live-room.tsx) ~L295) already has **結束對話**. It only stops the loop and routes to the transcript (`mode=script`). No review.
- **獨白式** ([`components/chat-room.tsx`](../../components/chat-room.tsx)) has **no** end control.
- Resuming `?session=` reloads transcript + chat-only stats ([`app/chat/[id]/page.tsx`](../../app/chat/[id]/page.tsx)); there is nowhere to store a debrief.

This spec adds: an explicit end action in **both** modes → one out-of-character Gemini JSON review → four on-screen sections (**建議 / 單字 / 文法 / 句子**) → persist one row per practice session so refresh / resume shows the same debrief. UI follows [`docs/DESIGN.md`](../DESIGN.md) (tokens only, no hex, no `dark:`). Login required; rows scoped by `user.id`.

`api_calls.kind` is documented today as `chat` | `tts`. This feature **adds `review`**. Reusing `chat` would inflate 「來回次數」([DATA.md](../DATA.md): round-trips count **only** `kind='chat'`). Review is a billed Gemini call, not a dialogue turn — same reason TTS is a separate kind.

This spec does **not** change [`docs/SCENARIOS.md`](../SCENARIOS.md) or public scenario `id`s. No secrets, API keys, or Client Secrets in D1, logs, or this spec.

## User stories

1. As a logged-in learner, I want to tap **結束對話** after a live or transcript practice so I receive a written debrief of **this** talk, not a mid-scene lecture.
2. As a logged-in learner, I want that debrief on screen in four labelled blocks — **建議**, **單字**, **文法**, **句子** — so I can see advice, words, grammar, and better sentences in one place.
3. As a logged-in learner, I want the debrief saved on my session so refresh or 「續接上次對話」 still shows it without spending another Gemini call.
4. As a logged-in learner, I want an honest error when I end before I have said anything, so an empty opening is not scored as a lesson.
5. As a logged-in learner, I want unauthenticated visitors kept out of generating or reading my review the same way as `/chat`.

## Acceptance criteria

- [ ] **AC1 (unauthenticated):** `POST /api/review` without a valid better-auth session returns **401** `{ "error": "請先登入" }`. No D1 read/write, no Gemini call. `GET /chat/:id` without a session cookie is already redirected by [`proxy.ts`](../../proxy.ts) matcher `/chat/:path*` to `/login?redirect=<pathname>` — **do not add a new public review URL**. Chat page loader still `getCurrentUser()` + `redirect("/login")` if the cookie is present but invalid. No new `proxy.ts` matcher is required if review stays on `/chat`.

- [ ] **AC2 (empty / too-short transcript):** Ending is refused until the session has **at least one `messages.role = 'user'` row** (learner utterance). The scenario opening (`role = 'model'`) does **not** count. Server **must** follow [POST lookup order](#post-apireview-lookup-order): **404 before** empty-transcript **400**. Do **not** call `countUserMessages` until `sessionExists` is true — a missing / other-user id that yields count `0` must **not** become 400 「至少說一句…」. Observable:
  - Client has no `sessionId`, or the learner has never successfully sent a turn: **do not POST**; show **至少說一句再結束，才有辦法給回饋。** Stay on the current mode (live does **not** route to `/scenarios`).
  - `POST /api/review` after an **owned** session is confirmed, with zero user messages: **400** `{ "error": "至少說一句再結束，才有辦法給回饋。" }`. **No** Gemini call, **no** `session_reviews` row, **no** `api_calls` row (validation failed before the provider).
  - Live **結束對話** with no `sessionId` uses the same user-visible sentence (replaces today’s fallback `router.push("/scenarios")` for this empty case).

- [ ] **AC3 (explicit end, both modes, not per turn):** Review runs **only** when the learner taps **結束對話**. Sending a chat turn, pausing live, silence retries, and page load / resume must **not** call Gemini review. Both modes `fetch("/api/review", { method: "POST", headers: apiHeaders(), body: JSON.stringify({ sessionId }) })` — **same** `apiHeaders()` as `/api/chat` (`Content-Type: application/json` plus `x-gemini-key` when `getApiKey()` is set). Key never in the JSON body. Observable:
  - **Live:** existing clay button copy stays **結束對話**. Tap → stop mic + TTS → `POST /api/review` with `apiHeaders()` and `{ sessionId }` → **on success only** navigate to `/chat/{scenarioId}?session={sessionId}&mode=script` where the four sections are visible. **On non-OK** (400 / 401 / 404 / 502 / 5xx): **stay on live**, show the response `error` string in the existing error well, do **not** `router.push`. Helper under the buttons becomes **結束後會給你建議、單字、文法與句子的回饋。** (replaces **結束後可以回頭看剛才實際講了什麼。**).
  - **Script:** add a control with the same copy **結束對話**, **above the sticky composer**, right-aligned in the `max-w-3xl` column, secondary outline pill per DESIGN (must not compete with the clay send button). Tap → `POST /api/review` with `apiHeaders()` → four sections render **below the transcript**, still inside that column. Composer may remain.
  - While the request is in flight, the end button is disabled and the loading copy **正在整理這次練習的回饋…** is visible. Chat `POST /api/chat` is unchanged and still uses `buildSystemInstruction()`.

- [ ] **AC4 (four sections + exact copy + JSON shape):** After a successful review, the transcript view shows a block titled **這次練習的回饋** with lead **根據你剛才說的內容整理。家教在對話裡不會出戲糾正；這份是另外產出的回顧。** Then exactly four section headings, in this order, with these strings (no synonyms):

  | Order | Heading |
  |---|---|
  | 1 | `建議` |
  | 2 | `單字` |
  | 3 | `文法` |
  | 4 | `句子` |

  Payload **must** match [Canonical JSON](#canonical-json) (same object in Gemini `responseSchema`, `POST` body `review`, and D1 `payload`). FE and BE **must not** invent parallel field names (`suggestions` vs `advice`, `words` vs `vocabulary`, etc.). A section whose array is empty still renders its heading plus **這次沒什麼需要特別標的。** After the four sections, a clay pill link **再練一次** → `/scenarios`. DESIGN tokens only (`bg-canvas`, `bg-surface`, `bg-surface-2`, `text-ink`, `text-ink-soft`, `text-ink-muted`, `border-line`, `bg-clay`, `text-on-clay`, `bg-clay-wash`, `shadow-[var(--shadow)]`, …). **No** bare hex / `rgb()`, **no** `dark:`. No new DESIGN tokens. Review panel uses the card recipe (`rounded-2xl border border-line bg-surface p-5`); section titles `font-display text-[18px]` / `text-[19px]`; block title `font-display text-[28px] sm:text-[32px]`; English examples `text-[16px] leading-7`; Chinese explanations `text-[14px] leading-7 text-ink-soft`. Enter with `.rise`. Homepage `STEPS[2]` body becomes **對話結束後，給你建議、單字、文法與句子四塊回饋。** Title **收下回饋** stays. Do **not** change `STEPS[0]`’s 「九個」.

- [ ] **AC5 (persist + resume, one review per session):** A successful generate **INSERT**s `session_reviews` keyed by `session_id` + `user_student_id` (`user_student_id = user.id`). Refresh and `/chat/[id]?session=` (resume) load that row in the RSC page (same pattern as `getHistory` / `getSessionStats`) and pass it into `ChatRoom` so the four sections appear **without** a new Gemini call. **200 `cached: true` only if** the existing row’s `payload` `JSON.parse`s to a valid `SessionReview` (all four array keys, items have required fields — [Canonical JSON](#canonical-json)). Then return that object; **no** new `api_calls` / `api_logs` row. First successful generate (no row, or row treated as missing) returns **201** with `cached: false`. Unreadable / schema-invalid stored `payload`: treat as **missing** — this **explicit POST** deletes or replaces that row, then generates, then INSERT; response **201**. Do **not** 200-cache the corrupt payload (that would hit `UNIQUE(session_id)` and echo garbage). RSC parse failure: hide the review block, `initialReview = null`, **do not** auto-POST. `UNIQUE(session_id)` race between two valid generates: loser re-reads; if parse is valid → **200** `cached: true` (no 500). Regenerating after more turns when a **valid** row exists is a **non-goal** (return 200 cached).

- [ ] **AC6 (separate Gemini call + kind `review` + tokens):** The review call is **not** `generateReply` and **not** `buildSystemInstruction`. Backend adds `generateReview` (+ `buildReviewInstruction`) in [`lib/gemini.ts`](../../lib/gemini.ts) and **exports** the `SessionReview` types from that file so FE/BE import one module (it is already client-imported for constants; still **must not** import the database). The route passes `onCall` → `logApiCall`. `ApiCallRecord.operation` gains `"review"`. `recordCall({ kind: "review", ... })` uses Gemini `usageMetadata` only (`promptTokenCount` / `candidatesTokenCount` / `thoughtsTokenCount` / `totalTokenCount`). **Do not estimate.** Key: `resolveGeminiApiKey(request)` exactly as `/api/chat` — reads server `GEMINI_API_KEY` then header `x-gemini-key` from `apiHeaders()`. Key never in JSON body, D1, or logs. Provider / generate failure **and** empty / unparseable / schema-invalid model JSON: insert `api_calls` `ok=0` with `error` **exactly** `回饋沒有產生，請再試一次。` (never concatenate `GeminiError.message`); emit `onCall` (`ok: false`); **do not** write `session_reviews`. HTTP status: `GeminiError.status` when the throw is `GeminiError`, **else 502** — not “provider or 502”. Malformed JSON is always **502**. JSON body is always `{ "error": "回饋沒有產生，請再試一次。" }`. Round-trip UI (`getSessionStats`, 「來回」chip, `getUsageByScenario`) stays **`kind='chat'` only**. Unfiltered `/usage` 「全部 token」 / daily series already `SUM` every kind, so review tokens appear there. Per-scenario caption becomes **只計對話呼叫，不含語音合成與談話回饋。** Daily bar `title` uses **次呼叫**, not **次來回**. No fifth usage tile.

- [ ] **AC7 (owner scope):** `POST /api/review` for a `sessionId` that does not exist **or** belongs to another user returns **404** `{ "error": "找不到這段對話" }` (same 404 for both; no 403). This 404 is decided by `sessionExists(sessionId, userId) === false` **before** any empty-transcript count (see [POST lookup order](#post-apireview-lookup-order)). `getSessionReview(sessionId, userId)` returns `undefined` on mismatch; the chat page then renders no review block. All helpers filter `sessions.user_student_id = user.id` / `session_reviews.user_student_id = user.id`. Scenario for `buildReviewInstruction` comes from **`sessions.scenario_id`** via `getSession` then `getScenario` — **not** from the POST body. Ignore extra `scenarioId` if sent. Do **not** return **404** `{ "error": "找不到這個情境" }` for a valid owned session.

- [ ] **AC8 (schema via 0006 + DATA.md):** New table and the `review` kind documentation land **only** in `migrations/0006_session_reviews.sql` + `wrangler d1 migrations apply fluently_db`. No second SQLite file, no runtime `ALTER`, no `node:sqlite`. `api_calls.kind` has no SQL CHECK today — do **not** rebuild `api_calls`; document allowed values `chat` | `tts` | `review` in [`docs/DATA.md`](../DATA.md) in the **same** backend commit (`CallKind`, `api_logs.operation`, `session_reviews`, named `lib/db.ts` helpers, 「來回次數只數 chat」unchanged). `api_calls` and `api_logs` stay separate tables.

## POST `/api/review` lookup order

Route handler **must** run these checks in this order (stop at the first match). Auth and JSON parse come first (401 / 400 `請求格式錯誤` / 401 missing key — same as `/api/chat`).

1. Trim `sessionId`. Missing or blank → **400** `{ "error": "缺少 sessionId" }`.
2. `sessionExists(sessionId, user.id)` is false (unknown **or** other user) → **404** `{ "error": "找不到這段對話" }`.
3. Owned session, `countUserMessages(sessionId, user.id) === 0` → **400** `{ "error": "至少說一句再結束，才有辦法給回饋。" }`. No Gemini, no `api_calls`.
4. Else continue: `getSession(sessionId, user.id)` then `getScenario(session.scenario_id)` for `buildReviewInstruction`. Ignore body `scenarioId`. If that catalog row is missing (orphan `scenario_id` on an owned session), **502** `{ "error": "回饋沒有產生，請再試一次。" }` — **not** 404 `找不到這個情境`.
5. Load `getSessionReview`. If `payload` parses to a valid `SessionReview` → **200** `{ cached: true, review, sessionId, model }` (no Gemini). If there is no row, **or** parse/schema fails: delete/replace that row if present, then generate → **201** `cached: false`.

## Canonical JSON

Single object. Stored as D1 `session_reviews.payload` (TEXT, JSON). Returned as `review` on `POST /api/review`. Gemini `generationConfig.responseMimeType = "application/json"` + `responseSchema` **must** describe this shape (property names below, not aliases).

```ts
type SessionReview = {
  advice: AdviceItem[];       // 建議 — 2–4 items when the transcript supports it
  vocabulary: VocabItem[];    // 單字 — 3–6 typical
  grammar: GrammarItem[];     // 文法 — 2–4 typical
  sentences: SentenceItem[];  // 句子 — 2–4 typical
};

type AdviceItem = {
  headline: string; // 繁體中文，短標題
  detail: string;   // 繁體中文說明（為何、下次怎麼做）
};

type VocabItem = {
  word: string;      // English word or short phrase
  meaningZh: string; // 繁體中文意思
  exampleEn: string; // English example sentence
  noteZh: string;    // 繁體中文：為何點這個字／怎麼用更自然
};

type GrammarItem = {
  pointZh: string;  // 繁體中文文法點名稱
  issueZh: string;  // 繁體中文：這次談話裡發生了什麼
  betterEn: string; // Corrected / more natural English
};

type SentenceItem = {
  originalEn: string; // Learner sentence (or close paraphrase of what they said)
  betterEn: string;   // More natural English
  whyZh: string;      // 繁體中文：為什麼這樣改
};
```

**Language split (contract):** Chinese-named `*Zh` / `headline` / `detail` / `pointZh` / `issueZh` / `whyZh` are Traditional Chinese. `word`, `exampleEn`, `betterEn`, `originalEn` are English. Prompt the model accordingly; do not 502 if a string is the wrong script (unreliable to test).

**Required keys:** `advice`, `vocabulary`, `grammar`, `sentences` must all be present as arrays. Each item must include **all** fields in its type (empty string allowed). Missing top-level key, non-array, or item missing a field → treat as malformed (**502**, `ok=0`, no persist). All four arrays empty is **valid** (UI placeholders). Extra keys ignored.

**Prompt bounds** (instruction + schema descriptions, not a 400): advice 2–4, vocabulary 3–6, grammar 2–4, sentences 2–4. Backend does not trim to these counts if the model returns more; FE renders what was stored.

## Frontend / backend fields

D1 / `lib/db.ts` = **snake_case**. JSON HTTP = **camelCase** of the same names except `review` which is the canonical object above.

### `POST /api/review`

| Field | Source | Type | Notes |
|---|---|---|---|
| headers | request | `apiHeaders()` | **Required.** Same helper as `/api/chat`: `Content-Type: application/json` and, when `getApiKey()` is set, `x-gemini-key`. Route uses `resolveGeminiApiKey(request)`. Key **never** in JSON body, D1, or logs. |
| `sessionId` | request JSON | `string` | Required after trim. Missing / empty → **400** `{ "error": "缺少 sessionId" }` |
| `scenarioId` | request JSON | ignored | Optional extra; **must not** drive lookup. Scenario comes from `sessions.scenario_id`. |
| `review` | response | `SessionReview` | Canonical object |
| `sessionId` | response | `string` | Echo |
| `cached` | response | `boolean` | `false` on 201 generate; `true` on 200 replay of a **valid** payload only |
| `usage` | response | `{ promptTokens, outputTokens, thoughtTokens, totalTokens }` | Only on 201; from `usageMetadata`. Omit on `cached: true` |
| `latencyMs` | response | `number` | Only on 201 |
| `model` | response | `string` | Model id used (or original stored model on cache) |
| `error` | response (fail) | `string` | Gemini / malformed JSON: **exactly** `回饋沒有產生，請再試一次。` — no provider text appended |

No other body fields required. Ignore unknown extras (including `scenarioId`).

### D1 `session_reviews` (`migrations/0006_session_reviews.sql`)

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT PRIMARY KEY` | `crypto.randomUUID()` |
| `session_id` | `TEXT NOT NULL UNIQUE` | `REFERENCES sessions(id) ON DELETE CASCADE` |
| `user_student_id` | `TEXT NOT NULL` | `= user.id`; application filter; no FK to `"user"` |
| `payload` | `TEXT NOT NULL` | Canonical `SessionReview` JSON |
| `model` | `TEXT NOT NULL` | Model id of the generate that wrote this row |
| `created_at` | `INTEGER NOT NULL` | epoch ms |

Index: `UNIQUE` on `session_id` is enough. Optional `idx_reviews_student` on `user_student_id` if the helper lists by user; **this spec does not add a reviews index page**.

### `lib/db.ts` helpers (backend exports; chat page imports)

| Export | Returns | Notes |
|---|---|---|
| `getSession(sessionId, userId)` | session row (`id`, `scenario_id`, `user_student_id`, `mode`, `created_at`, `updated_at`) \| `undefined` | `undefined` when missing or `user_student_id` mismatch. POST uses `scenario_id` → `getScenario` for `buildReviewInstruction`. |
| `getSessionReview(sessionId, userId)` | `{ id, session_id, user_student_id, payload, model, created_at } \| undefined` | `undefined` if missing or `user_student_id` mismatch. Caller `JSON.parse(payload)` behind a try; corrupt / invalid schema → treat as missing for **display** (do not crash the chat page; do not auto-POST). |
| `insertSessionReview({ sessionId, userId, payload, model })` | `id` | INSERT after a successful generate. On UNIQUE conflict with a **valid** payload, route re-reads and returns 200. |
| `deleteSessionReview(sessionId, userId)` | void | Used when stored `payload` is unreadable / invalid **on an explicit POST**, before generate + INSERT (201). |
| `countUserMessages(sessionId, userId)` | `number` | `COUNT(*)` of `messages` with `role='user'` for that **owned** session. Call **only after** `sessionExists` is true. Must **not** be the ownership check; must **not** return 0 as a stand-in for “not owned”. |

Frontend does **not** write `lib/db.ts`. Backend does **not** write `components/**` or `app/chat/**` / `app/page.tsx` / `app/usage/page.tsx`. `SessionReview` types live in [`lib/gemini.ts`](../../lib/gemini.ts) (backend-owned file; frontend **imports the type only**).

### Gemini review call

| Field | Source | Type | Notes |
|---|---|---|---|
| System instruction | `buildReviewInstruction(scenario)` | string | **Coach**, Traditional-Chinese + English split as in Canonical JSON. Include `scenario.title`, `titleZh`, `level`, `focus` so notes match the scene. **Must not** tell the model to stay in character. **Must not** change `buildSystemInstruction()`. |
| User content | `getHistory(sessionId, userId)` | transcript | Format as labelled turns, e.g. `Learner: …` / `Tutor: …`. Same 40-message cap as chat history. |
| `temperature` | generate config | `0.4` | Lower than in-scene `0.9` |
| `maxOutputTokens` | generate config | `2048` | In-scene chat stays `400` |
| `onCall.operation` | `ApiCallRecord` | `"review"` | Success and failure |
| `api_calls.kind` | D1 | `"review"` | `CallKind` becomes `"chat" \| "tts" \| "review"` |
| API key | request | header / env | Same as chat: `resolveGeminiApiKey(request)` (`x-gemini-key` from `apiHeaders()`, then server env). Never in body. |
| Failure HTTP | route | number | `GeminiError.status` if `GeminiError`, else **502**. Response `error` always `回饋沒有產生，請再試一次。` |
| Model | env / default | string | Same as chat: `GEMINI_MODEL` or `DEFAULT_MODEL` |

### Chat page / components

| Field | Source | Type | Notes |
|---|---|---|---|
| `initialReview` | RSC → `ChatRoom` | `SessionReview \| null` | From `getSessionReview` when `resumeId` is set **and** payload is valid; else `null` |
| End control | UI | button | Copy **結束對話**. Script: **above the sticky composer**, right-aligned, secondary outline pill (AC3) |
| Review request | client | `fetch` | `headers: apiHeaders()`, body `{ sessionId }` only |
| Loading | UI | text | **正在整理這次練習的回饋…** |
| Review title | UI | text | **這次練習的回饋** |
| Review lead | UI | text | **根據你剛才說的內容整理。家教在對話裡不會出戲糾正；這份是另外產出的回顧。** |
| Empty section | UI | text | **這次沒什麼需要特別標的。** |
| Retry CTA | UI | link | **再練一次** → `/scenarios` |
| Live helper | UI | text | **結束後會給你建議、單字、文法與句子的回饋。** |
| Homepage step 03 body | UI | text | **對話結束後，給你建議、單字、文法與句子四塊回饋。** |
| Usage caption | UI | text | **只計對話呼叫，不含語音合成與談話回饋。** |
| Daily bar `title` | UI | text | Use **次呼叫**, not **次來回** |

Shared POST + pending/error **may** live in [`lib/use-conversation.ts`](../../lib/use-conversation.ts) (frontend-owned `use-*`).

## Errors

| Case | User-visible | API / log |
|---|---|---|
| No session cookie on `/chat` | Redirect `/login?redirect=/chat/…` | proxy; no D1 |
| `POST /api/review` not logged in | (client already on `/chat` if cookie missing) | **401** `{ "error": "請先登入" }`; no Gemini |
| No Gemini key | **還沒有 API key。打開右上角設定，貼上你的 Gemini API key。** (same sentence as `/api/chat`) | **401**; no `session_reviews`; no `api_calls` |
| Body not JSON | **請求格式錯誤** | **400** |
| Missing / blank `sessionId` | **缺少 sessionId** | **400** — lookup step 1 |
| Unknown or other-user `sessionId` | **找不到這段對話** | **404** (identical) — lookup step 2, **before** empty-transcript 400 |
| Zero learner utterances (owned) | **至少說一句再結束，才有辦法給回饋。** | **400**; no Gemini; no `api_calls` — lookup step 3 |
| Client has no session / never sent | Same sentence; stay on page | No POST |
| Gemini HTTP / `GeminiError` | **回饋沒有產生，請再試一次。** | HTTP **`GeminiError.status`**; body `{ "error": "回饋沒有產生，請再試一次。" }` only (do **not** put provider text in `error`); `api_calls.ok=0`; `api_logs.ok=0`; `operation=review`; no persist |
| Empty / unparseable / schema-invalid model JSON | **回饋沒有產生，請再試一次。** | **502**; same `{ "error": "回饋沒有產生，請再試一次。" }`; `ok=0`; no persist |
| Any other thrown Error after generate was attempted | **回饋沒有產生，請再試一次。** | **502**; same body; `ok=0`; no persist |
| Owned session, scenario catalog row missing | **回饋沒有產生，請再試一次。** | **502**; same body; no Gemini; no `api_calls` |
| Network / thrown `Error` before the route | **連線失敗，請確認 dev server 還在跑。** (existing conversation copy) | no row if the request never reached the route |
| UNIQUE race (valid payload) | Four sections still appear | **200** `cached: true` |
| Corrupt stored `payload` on RSC | Hide review block; no auto-POST | `initialReview = null` |
| Corrupt stored `payload` on explicit POST | Loading then four sections from a new generate | Delete/replace row; **201** `cached: false`; new `api_calls` `kind=review` |

Never put the API key, `BETTER_AUTH_SECRET`, or Client Secret in `error`, `api_logs.input/output`, or `payload`.

## Non-goals

- Do **not** change `buildSystemInstruction()` or in-scene `generateReply` JSON (`reply` / `emotion`). No mid-turn score, grammar popover, or tutor-as-teacher.
- Do **not** estimate tokens. Do **not** merge `api_calls` with `api_logs`.
- Do **not** add a ninth scenario or retouch public `id`s / [`docs/SCENARIOS.md`](../SCENARIOS.md).
- Do **not** add DESIGN tokens, `dark:` classes, or a dedicated `/review` route.
- Do **not** lock `POST /api/chat` after a review (composer may stay). Do **not** auto-regenerate when the learner talks more.
- Do **not** add a `/usage` fifth tile or count `review` in 「對話來回次數」.
- Do **not** TTS the review. Do **not** store the review as a `messages` row.
- Do **not** put secrets in the spec, D1, or logs.
- Homepage 「從九個日常…」 copy is pre-existing and out of scope.

## Handoff

- Goal: Spec fix (produce 2) so Gemini failures share one `{ "error" }` and HTTP rule, POST uses `apiHeaders()` / `x-gemini-key` like chat, and lookup is 404 → empty 400, scenario from `sessions.scenario_id`, 200 cached only on valid payload.
- Changes: [`docs/specs/post-chat-review.md`](./post-chat-review.md) only. [`docs/SCENARIOS.md`](../SCENARIOS.md) untouched.
- Next Step: QA spec review pass 2 (`qa` subagent). Must-fix 1–3 from review 1 addressed; this was the one allowed spec fix.
