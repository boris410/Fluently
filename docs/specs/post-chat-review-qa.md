# Diff QA: post-chat-review

- Slug: `post-chat-review`
- review_pass: **1** (diff review)
- Result: **PASS**
- Spec: [`docs/specs/post-chat-review.md`](./post-chat-review.md) AC1–AC8, POST lookup order, Errors table, Canonical JSON
- Scope: `git status` + `git diff` (untracked included). Product files for this feature only. No product code in this review.
- Lint this pass: `npm run lint` **passed**. `npm run build` not run here; still required before ship.

Must-fix: **none**. Should-fix does not start another produce.

---

## Must-fix: none

Checked the items called out for this pass; none fail AC.

| Check | Owner | Result |
|---|---|---|
| Unauthenticated `POST /api/review` → **401** `{ "error": "請先登入" }`, no Gemini | backend | PASS — `getCurrentUser()` first; no `sessionExists` / generate |
| Lookup **404 before** empty **400** | backend | PASS — `sessionExists` then `countUserMessages`; unknown / other-user is 404 `找不到這段對話`, not 400 |
| Client `apiHeaders()` + `x-gemini-key`; key never in JSON body | frontend + backend | PASS — `fetch(..., { headers: apiHeaders(), body: JSON.stringify({ sessionId }) })`; route `resolveGeminiApiKey(request)` like `/api/chat` |
| Provider / malformed JSON `error` **exactly** `回饋沒有產生，請再試一次。` | backend | PASS — HTTP body and `api_calls.error` use `REVIEW_FAIL`; no `GeminiError.message` concatenation. `GeminiError.status` else **502**. Malformed / empty model JSON throws `GeminiError` 502 |
| `kind: "review"` not counted as 來回 | backend + frontend | PASS — `getSessionStats` / `getUsageByScenario` / 來回 chip stay `kind='chat'`. Usage tiles still four (no fifth). Daily series unfiltered (review tokens included) |
| Four headings **建議 / 單字 / 文法 / 句子** | frontend | PASS — exact strings, that order |
| Live non-OK: stay, error well, **no** `router.push` | frontend | PASS — `requestReview` returns `null`; `finish` only pushes on success |
| No auto review on send / pause / load | frontend | PASS — only **結束對話** → `requestReview`. Resume uses RSC `initialReview`, no auto-POST |
| `SessionReview` from `lib/gemini.ts` | both | PASS — types + `parseSessionReview` exported; FE imports that module; file still does not import DB |
| DESIGN tokens; no hex / `dark:` | frontend | PASS — card / display sizes / clay pill / 描邊 pill per DESIGN |
| `buildSystemInstruction()` unchanged | backend | PASS — in-scene prompt untouched; review is `buildReviewInstruction` + `generateReview` |
| No 9th scenario | both | PASS — `docs/SCENARIOS.md` / public ids untouched; homepage `STEPS[0]` still 「九個」 |
| Secrets not in D1 / logs / payload | backend | PASS — key is header/`resolveGeminiApiKey` only; `onCall` logs transcript + model JSON; `payload` is Canonical JSON |
| Homepage `STEPS[2]` copy | frontend | PASS — title **收下回饋**; body **對話結束後，給你建議、單字、文法與句子四塊回饋。** |
| Usage caption + daily bar **次呼叫** | frontend | PASS — caption **只計對話呼叫，不含語音合成與談話回饋。**; `title` uses **次呼叫** |

---

## Should-fix (do not produce, do not STOP)

1. **frontend** — Any `POST /api/review` **401** (including `請先登入`) still `setRejectedKey(true)`, so the existing 「還沒設定 Gemini API key」 well can appear next to the real `error` string. Same pattern as `/api/chat`; rare on `/chat` (proxy already gates missing cookies).
2. **frontend** — End control is `disabled={reviewPending}` only. A double-tap before React commits, or sending a chat turn while review is in flight, can race `getHistory`. Composer staying enabled is allowed (non-goal); not an AC miss.
3. **backend** — `deleteSessionReview` / `getHistory` sit outside the generate `try`. A D1 throw there is an unhandled 500, not the Errors-table 502 `{ "error": "回饋沒有產生，請再試一次。" }`.
4. **backend** — Spec leftover: `maxOutputTokens: 2048` may still truncate four bilingual arrays → 502 + `ok=0`. Error contract is defined.
5. **frontend** — Advice `headline` (繁中短標題) uses `text-[16px]` (English-example size). Spec only hard-splits English examples vs Chinese explanations; headings still render.

---

## AC vs diff

| AC | Result | Notes |
|---|---|---|
| AC1 unauthenticated | PASS | 401 `請先登入` before D1/Gemini. No public `/review` page. Chat RSC still `getCurrentUser()` + `redirect("/login")`. `proxy.ts` matcher for `/chat` unchanged (only `/runs` added elsewhere). |
| AC2 empty / too-short | PASS | Client: no `sessionId` or no local `role==="user"` → no POST, exact sentence, live does not `router.push("/scenarios")`. Server: owned + zero user rows → 400, no Gemini / `session_reviews` / `api_calls`. 404 decided first. |
| AC3 explicit end both modes | PASS | Live clay **結束對話** → stop mic/TTS → POST → success only to `mode=script`. Helper copy replaced. Script: 描邊 pill **結束對話** above sticky composer, `justify-end` in `max-w-3xl`. Loading **正在整理這次練習的回饋…**. `/api/chat` file unmodified. |
| AC4 four sections + copy + JSON | PASS | Block title/lead/empty/再練一次 exact. Canonical keys `advice` / `vocabulary` / `grammar` / `sentences`. Empty arrays still show heading + placeholder. Tokens only. `.rise` + card recipe. |
| AC5 persist + resume | PASS | `session_reviews` UNIQUE(`session_id`). RSC `getSessionReview` + parse; invalid → `initialReview = null`, no auto-POST. Valid cache → 200 `cached: true` (no usage). Generate → 201 `cached: false`. Corrupt row deleted then INSERT. UNIQUE loser re-reads valid → 200. |
| AC6 separate Gemini call + kind | PASS | `generateReview` / `buildReviewInstruction`; `operation: "review"`; `recordCall({ kind: "review" })`; tokens from `usageMetadata`. Failure `ok=0`, no persist. Round-trip UIs stay chat-only. |
| AC7 owner scope | PASS | Missing / other-user → 404 `找不到這段對話`. Scenario from `sessions.scenario_id` via `getSession` → `getScenario`. Extra `scenarioId` ignored. Orphan catalog row → 502, not 404 `找不到這個情境`. Helpers filter `user_student_id`. |
| AC8 schema 0006 + DATA.md | PASS | `migrations/0006_session_reviews.sql` only (no runtime `ALTER`, no `node:sqlite`, `api_calls` not rebuilt). `docs/DATA.md` documents `chat` \| `tts` \| `review`, `session_reviews`, named helpers, 來回只數 chat. `api_calls` / `api_logs` stay separate. |

### POST lookup order

1. Auth 401 `請先登入` → missing key 401 (same sentence as chat) → JSON 400 `請求格式錯誤` → trim `sessionId` 400 `缺少 sessionId`
2. `sessionExists` false → 404 `找不到這段對話`
3. `countUserMessages === 0` → 400 `至少說一句再結束，才有辦法給回饋。`
4. `getSession` / `getScenario`; missing catalog → 502 `回饋沒有產生，請再試一次。`
5. Valid stored payload → 200; else delete + generate → 201

### Canonical JSON

`lib/gemini.ts` `SessionReview` + `REVIEW_RESPONSE_SCHEMA` + `parseSessionReview` match the spec field names. Missing key / non-array / item missing a field → null → 502. All-empty arrays valid.

---

## Runnable checklist

Apply local D1 if not already: `npx wrangler d1 migrations apply fluently_db --local`

```bash
npm run build && npm run lint
```

Manual (logged-in, Gemini key available):

1. **AC1** — `curl -s -o /dev/stderr -w "%{http_code}" -X POST http://localhost:3000/api/review -H 'content-type: application/json' -d '{"sessionId":"x"}'` → **401** body `請先登入`. Logged-out `/chat/:id` still redirects to login.
2. **AC2 client** — Open live or script, tap **結束對話** before any learner turn (opening only). See **至少說一句再結束，才有辦法給回饋。**. Live stays on live (no `/scenarios`).
3. **AC2/AC7 lookup** — POST other-user or unknown `sessionId` (cookie valid, key present) → **404** `找不到這段對話`, not 400. Owned session with zero `messages.role='user'` → **400** empty sentence; no new `session_reviews` / `api_calls`.
4. **AC3 live success** — Speak at least one turn → **結束對話** → button disabled + **正在整理這次練習的回饋…** → land on `/chat/{id}?session=…&mode=script` with four sections. Helper under buttons is the new copy.
5. **AC3 live fail** — Force 502 (invalid key after login, or airplane mode after tap) → stay on live, error well shows server `error`, URL does not change.
6. **AC3 script** — **結束對話** is a 描邊 pill above the composer, right-aligned. Four sections render below the transcript; composer remains. Send / pause / refresh do **not** call `/api/review`.
7. **AC4** — Headings exactly 建議, 單字, 文法, 句子. Empty section shows **這次沒什麼需要特別標的。**. **再練一次** → `/scenarios`. Homepage step 03 body is the four-block sentence; step 01 still 「九個」.
8. **AC5** — Refresh / 「續接上次對話」 shows the same debrief without a new Gemini call. Second **結束對話** on a valid row → 200 `cached: true` (Network).
9. **AC6** — After a review, 來回 chip and 對話來回次數 unchanged; `/usage` caption and daily bar `title` (**次呼叫**) as spec. Failed generate: `api_calls.kind='review'` `ok=0`, `error` exactly `回饋沒有產生，請再試一次。`, no `session_reviews` row.
10. **AC6/AC8** — Confirm `session_reviews` exists via 0006; `api_calls` has no new CHECK. No API key in `api_logs.input/output/error` or `payload`.

---

## Handoff

- Goal: Diff review 1 of post-chat review against AC1–AC8.
- Changes: [`docs/specs/post-chat-review-qa.md`](./post-chat-review-qa.md) → **PASS**. Must-fix none. Should-fix 1–5 recorded, no second produce.
- Next Step: `review_pass: 1`. **PASS**. Do not call frontend or backend to fix. Ship checklist: `npm run build && npm run lint` (lint already green this pass).
