# Spec: Agent loop board

- Slug: `agent-loop-board`
- Status: qa-diff-pass
- Source request: 幫我把 各個角色來回思考時的 token、回饋，記錄到 SQLite 然後產生一個介面我可以看到目前需求執行階段，遇到的困難以及決策

## Background

Fluently already records **Gemini practice usage** in D1 (`api_calls` / `api_logs`, UI at `/usage` and `/logs`). Token numbers there come from Gemini `usageMetadata` and must not be estimated ([`docs/DATA.md`](../DATA.md)). Dev and production share **one** Cloudflare D1 (`node:sqlite` is retired).

This spec adds a **second, separate stream**: the Cursor multi-role feature loop (orchestrator → `pm` → `qa` → `frontend` / `backend`) described in [`.cursor/skills/fluently-feature-loop/SKILL.md`](../../.cursor/skills/fluently-feature-loop/SKILL.md). Each role returns Goal / Changes / Next Step; QA can Must-fix; a role that still has Must-fix after review 2 **STOP**s. The owner needs a board that shows:

1. **Stage** — which role / kind / review pass the current request is in (`尚未開始` when there are no turns yet).
2. **Difficulties** — Must-fix items, STOP leftovers, and same-file conflicts.
3. **Decisions** — explicit decision text plus Next Step.
4. **Tokens** — `tokens_in` / `tokens_out` for that Cursor subagent turn when known; **NULL when unknown**. These are **not** Gemini `usageMetadata` and **must not** be written to `api_calls`.

Storage is D1 via `migrations/0005_*.sql` only. Rows are scoped to the logged-in owner (`user.id`), same gating pattern as `/usage`: [`proxy.ts`](../../proxy.ts) cookie check plus `getCurrentUser()` on pages and APIs. UI follows [`docs/DESIGN.md`](../DESIGN.md) and the warmth of [`app/usage/page.tsx`](../../app/usage/page.tsx) (compact header, `max-w-6xl`, stat tiles, dashed empty state). No ninth scenario; no secrets in D1, logs, or this spec.

**Page read contract matches `/usage`:** backend exports named helpers from `lib/db.ts`; pages import them and read **snake_case** fields. `GET /api/runs*` is a camelCase wrap of those same fields for the orchestrator — pages do **not** `fetch` the API.

The orchestrator (not PM/FE/BE) POSTs after each subagent. After frontend and backend land, the **orchestrator** updates the skill so the loop is required to create a run and append turns. This spec does not change [`docs/SCENARIOS.md`](../SCENARIOS.md).

## User stories

1. As a logged-in owner, I want each feature-loop run stored in my D1 account so I can reopen it later without mixing it into Gemini practice usage.
2. As a logged-in owner, I want a `/runs` list that shows each request’s current stage, status, and token totals (or an em dash when unknown) so I can see what is in flight.
3. As a logged-in owner, I want `/runs/[id]` to show difficulties (Must-fix, STOP leftovers, same-file conflicts) and decisions (decision text + Next Step) so I know what blocked the loop and what was chosen next.
4. As the orchestrator, I want authenticated POST APIs to create a run at loop start and append a turn after every subagent so the board stays in sync with Goal / Changes / Next Step, kind, review pass, and outcome.
5. As a logged-in owner, I want unauthenticated visitors kept out of `/runs` the same way as `/usage`, so another person cannot read my loop board.

## Acceptance criteria

- [ ] **AC1 (unauthenticated):** `GET /runs` and `GET /runs/<any-id>` without a better-auth session cookie are redirected to `/login?redirect=<pathname>` because `proxy.ts` `matcher` includes `/runs` and `/runs/:path*` (same shape as `/usage`). **Frontend owns that matcher edit for this feature;** backend does not touch `proxy.ts`. Page loaders still call `getCurrentUser()` and `redirect("/login")` if the cookie is present but invalid. `GET`/`POST`/`PATCH` under `/api/runs` without a valid session return **401** `{ "error": "請先登入" }` (APIs are not in the proxy matcher; auth is `getCurrentUser()` only). No D1 row is read or written.

- [ ] **AC2 (unknown tokens → NULL):** `POST /api/runs/:id/turns` with `tokensIn` / `tokensOut` omitted or JSON `null` persists D1 `INTEGER NULL`. UI shows **—** (U+2014), not `0`. List/detail aggregates use SQL `SUM` (NULL skipped); if the aggregate is NULL, the total displays **—**, not `0`. Reject **400** (no row) when a provided value is not an integer ≥ 0: JSON number that is negative or not an integer, or a non-null non-number (including numeric **strings** — do not coerce `"12"` to `12`). These values are **never** copied into `api_calls` / `api_logs`. Do not estimate missing tokens (non-goal, not a 400 case).

- [ ] **AC3 (owner scope):** `POST /api/runs` with `sourceRequest` that is non-empty **after trim** as the logged-in user returns **201** `{ run }` with `user_id` / `userId` = `user.id`. `GET /runs` lists **only** that user’s runs, newest `updated_at` first (via `listAgentRuns(user.id)`). `GET /runs/<id>` and `GET`/`PATCH` `/api/runs/:id` and `POST /api/runs/:id/turns` for another user’s id or an unknown id return **404**. Page copy is always `找不到這筆執行。` plus link `← 需求執行` (do **not** use the generic Next 404; this repo has no `not-found.tsx`). API: `{ "error": "找不到這筆執行" }`. No cross-user leak via 403 vs 404 distinction.

- [ ] **AC4 (stage, difficulties, decisions):** Detail `/runs/[id]` is RSC (`dynamic = "force-dynamic"`, no client JS), importing `getAgentRun(user.id, id)` like `/usage` imports `lib/db.ts`:
  - **Stage:** if `latest_role` is NULL: `尚未開始`. Else: `{roleLabel} · {kindLabel} · 第 {reviewPass} 次` plus `run.status` chip.
  - **Difficulties:** every turn with `difficulty_kind` in `must-fix` | `stop-leftover` | `same-file-conflict` (feedback text visible). If none: `目前沒有記錄到的困難。`
  - **Decisions:** every turn where `decision` and/or `next_step` is non-null, showing 決策 / 下一步. If none: `目前沒有記錄到的決策。`
  - Timeline of all turns (native `<details>` / `<summary>` per [`docs/DESIGN.md`](../DESIGN.md) expandable-row recipe), including goal, changes, feedback, tokens (`輸入 {in} · 輸出 {out}`, — per side when NULL).

- [ ] **AC5 (validation + secrets):** After trim, empty or missing `sourceRequest` → **400** `需求內容是空的`. Unknown `role` / `kind` / `outcome` / `difficultyKind`, `reviewPass` not `1` or `2`, `specSlug` longer than 128 chars, or any text field containing the concrete prefixes `API_KEY=`, `CLIENT_SECRET=`, `BETTER_AUTH_SECRET=`, or `ELEVENLABS_API_KEY=` → **400**, **no INSERT/UPDATE**. Responses and D1 must not echo the rejected secret. Known env **names** may appear in this spec; **values** must not.

- [ ] **AC6 (skill contract):** After frontend and backend have landed, [`.cursor/skills/fluently-feature-loop/SKILL.md`](../../.cursor/skills/fluently-feature-loop/SKILL.md) **must** require the orchestrator to: (1) `POST /api/runs` at loop start with the user’s source request; (2) `POST /api/runs/:id/turns` after **each** subagent with required `role`, `kind`, `reviewPass`, `outcome` and optional Goal / Changes / Next Step / feedback / decision / difficultyKind / tokens (`null` if unknown); (3) set `difficultyKind` for Must-fix, STOP leftovers, and same-file conflicts (same-file uses the orchestrator tuple below); (4) `PATCH` run `status` to `passed` or `stopped` when the loop ends. **Frontend/backend do not edit the skill**; the orchestrator updates it after they land. Until that edit, this AC is pending but is part of the feature.

- [ ] **AC7 (schema isolation):** New tables exist only via `migrations/0005_*.sql` (suggested name `0005_agent_loop.sql`) + `wrangler d1 migrations apply fluently_db`. No second SQLite file, no runtime `ALTER`. Backend updates [`docs/DATA.md`](../DATA.md) in the **same** commit: tables, indexes, named `lib/db.ts` helpers, “do not merge with `api_calls`”. Existing Gemini `/usage` behaviour unchanged.

- [ ] **AC8 (list + tiles + UI tokens):** `/runs` and `/runs/[id]` use DESIGN tokens only (`bg-canvas`, `text-ink`, `bg-surface`, `border-line`, `bg-clay`, `text-on-clay`, `bg-clay-wash`, `text-ink-muted`, `bg-surface-2`, `shadow-[var(--shadow)]`, …). **No** bare hex / `rgb()`, **no** `dark:` prefix. Layout matches `/usage`: `SiteHeader compact`, `px-5 py-14 sm:px-8 sm:py-16`, `max-w-6xl`, `font-display` page title `text-[36px] sm:text-[44px]`. **User menu and settings menu** each gain **需求執行** → `/runs` next to 用量統計.
  - **Zero runs:** only the dashed empty card (`還沒有任何需求執行紀錄。`). **Do not** render four tiles of zeros.
  - **Non-zero:** four tiles (SQL below). Hero 進行中 is the only `text-clay` number.
  - **Each list row:** status chip + stage line + truncated `source_request` + token totals (`輸入 {in} · 輸出 {out}`) + link to `/runs/[id]`. Card recipe from DESIGN.

## Frontend / backend fields

D1 columns and `lib/db.ts` return fields are **snake_case**. JSON request/response bodies are **camelCase** of the same names (`tokensInSum` ↔ `tokens_in_sum`).

### `lib/db.ts` page contract (required)

Backend **must** export these. Pages **must** import them (same pattern as `getTotals` on `/usage`). Frontend does not write `lib/db.ts`. Backend does not write `app/runs/**`.

| Export | Returns | Notes |
|---|---|---|
| `listAgentRuns(userId)` | `AgentRunListRow[]` | Cap **50**, `ORDER BY updated_at DESC`, `user_id = userId` only. |
| `getAgentRun(userId, id)` | `{ run: AgentRunListRow, turns: AgentTurnRow[] } \| undefined` | `undefined` when missing or `user_id` mismatch. Turns `ORDER BY id ASC`. |
| `countAgentRunsByStatus(userId)` | `{ running_count, passed_count, stopped_count }` | `COUNT(*)` over **all** that user’s runs (not the 50-cap list). |

`AgentRunListRow` (every field, snake_case):

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `user_id` | `string` | |
| `source_request` | `string` | |
| `spec_slug` | `string \| null` | |
| `status` | `'running' \| 'passed' \| 'stopped'` | |
| `latest_role` | `string \| null` | NULL until first turn → stage copy `尚未開始` |
| `latest_kind` | `string \| null` | |
| `latest_review_pass` | `1 \| 2 \| null` | |
| `latest_outcome` | `string \| null` | |
| `latest_next_step` | `string \| null` | |
| `tokens_in_sum` | `number \| null` | `SUM(tokens_in)` for this run’s turns; NULL if every `tokens_in` is NULL |
| `tokens_out_sum` | `number \| null` | `SUM(tokens_out)` for this run’s turns; NULL if every `tokens_out` is NULL |
| `turn_count` | `number` | `COUNT(*)` of turns; `0` when none |
| `created_at` | `number` | epoch ms |
| `updated_at` | `number` | epoch ms |

`AgentTurnRow` (every field, snake_case):

| Field | Type |
|---|---|
| `id` | `number` |
| `run_id` | `string` |
| `user_id` | `string` |
| `role` | `string` |
| `kind` | `string` |
| `review_pass` | `1 \| 2` |
| `outcome` | `string` |
| `goal` | `string \| null` |
| `changes` | `string \| null` |
| `next_step` | `string \| null` |
| `feedback` | `string \| null` |
| `decision` | `string \| null` |
| `difficulty_kind` | `string \| null` |
| `tokens_in` | `number \| null` |
| `tokens_out` | `number \| null` |
| `created_at` | `number` |

GET `/api/runs` → `{ runs: AgentRunListRowCamel[] }` and GET `/api/runs/:id` → `{ run, turns }` use the **same** fields in camelCase (`userId`, `sourceRequest`, `specSlug`, `latestRole`, `latestKind`, `latestReviewPass`, `latestOutcome`, `latestNextStep`, `tokensInSum`, `tokensOutSum`, `turnCount`, `createdAt`, `updatedAt`; turn: `runId`, `reviewPass`, `nextStep`, `difficultyKind`, `tokensIn`, `tokensOut`, `createdAt`, …).

### Hero tiles (list page, only when `listAgentRuns` length > 0)

| Tile | SQL / formula | UI |
|---|---|---|
| 進行中 (hero, `text-clay`) | `COUNT(*)` from `agent_runs` where `user_id=? AND status='running'` → `running_count` | integer |
| 已完成 | `COUNT(*)` where `status='passed'` → `passed_count` | integer |
| 已停止 | `COUNT(*)` where `status='stopped'` → `stopped_count` | integer |
| 已知 token | Over **listed** (cap 50) runs’ turns: if `SUM(tokens_in)` and `SUM(tokens_out)` are both NULL → NULL. Else `COALESCE(SUM(tokens_in),0) + COALESCE(SUM(tokens_out),0)`. Equivalent from list rows: if every `tokens_in_sum` and `tokens_out_sum` is NULL → NULL; else sum the non-null sums. | NULL → **—**, never `0` for “all unknown” |

List/detail per-run token line: `輸入 {tokens_in_sum} · 輸出 {tokens_out_sum}` with **—** per side when that field is NULL.

### `agent_runs` (D1)

| Field | Source | Type | Notes |
|---|---|---|---|
| `id` | API | `TEXT PK` | `crypto.randomUUID()` |
| `user_id` | session | `TEXT NOT NULL` | `getCurrentUser().id`. No FK to `"user"`. All queries filter this column. |
| `source_request` | API `sourceRequest` | `TEXT NOT NULL` | Trim; after trim empty → 400. Max 4000 chars (truncate after secret check). |
| `spec_slug` | API `specSlug` | `TEXT NULL` | Max **128**. Optional at create. `PATCH`: omit = leave unchanged; trim then empty string → store **NULL** (clear); longer than 128 → 400. |
| `status` | API / derived | `TEXT NOT NULL` | `CHECK (status IN ('running','passed','stopped'))`. Create → `running`. `PATCH` to `passed` \| `stopped`. Posting a turn with `outcome='stop'` also sets `stopped`. **POST `/api/runs/:id/turns` is allowed after `passed` or `stopped`** (append leftovers); it does not reopen `status` unless `outcome='stop'` sets `stopped`. |
| `latest_role` | last turn | `TEXT NULL` | Denormalized for the list. |
| `latest_kind` | last turn | `TEXT NULL` | |
| `latest_review_pass` | last turn | `INTEGER NULL` | `1` or `2`. |
| `latest_outcome` | last turn | `TEXT NULL` | |
| `latest_next_step` | last turn | `TEXT NULL` | |
| `created_at` | server | `INTEGER NOT NULL` | epoch ms |
| `updated_at` | server | `INTEGER NOT NULL` | epoch ms; bumped on every turn / PATCH |

Index: `idx_agent_runs_user_updated (user_id, updated_at DESC)`.

### `agent_turns` (D1)

| Field | Source | Type | Notes |
|---|---|---|---|
| `id` | DB | `INTEGER PK AUTOINCREMENT` | |
| `run_id` | URL | `TEXT NOT NULL` | `REFERENCES agent_runs(id) ON DELETE CASCADE` |
| `user_id` | session | `TEXT NOT NULL` | Must equal parent `agent_runs.user_id`. |
| `role` | API | `TEXT NOT NULL` | `CHECK (role IN ('orchestrator','pm','qa','frontend','backend'))` |
| `kind` | API | `TEXT NOT NULL` | `CHECK (kind IN ('produce','review','fix'))` only — **no fourth kind**. Produce 1 → `produce`; the one allowed repair → `fix`; QA → `review`. |
| `review_pass` | API `reviewPass` | `INTEGER NOT NULL` | `CHECK (review_pass IN (1, 2))`. Produce 1 / Review 1 → `1`; Produce 2 (fix) / Review 2 → `2`. |
| `outcome` | API | `TEXT NOT NULL` | `CHECK (outcome IN ('pass','must-fix','stop','ok','error'))`. QA PASS → `pass`; QA Must-fix → `must-fix`; retry-cap STOP → `stop`; successful produce/fix → `ok`; crash/empty → `error`. |
| `goal` | API | `TEXT NULL` | Max 4000. |
| `changes` | API | `TEXT NULL` | Max 4000. |
| `next_step` | API | `TEXT NULL` | Max 4000. Part of **Decisions**. |
| `feedback` | API | `TEXT NULL` | Max 4000. |
| `decision` | API | `TEXT NULL` | Max 4000. Part of **Decisions**. |
| `difficulty_kind` | API `difficultyKind` | `TEXT NULL` | `CHECK (difficulty_kind IN ('must-fix','stop-leftover','same-file-conflict') OR difficulty_kind IS NULL)`. If omitted: default `must-fix` when `outcome='must-fix'`; default `stop-leftover` when `outcome='stop'`; otherwise NULL. Should-fix text may live in `feedback` but **must not** set `difficulty_kind`. |
| `tokens_in` | API `tokensIn` | `INTEGER NULL` | NULL if unknown. Never 0-fill. Never estimate. |
| `tokens_out` | API `tokensOut` | `INTEGER NULL` | Same rules. |
| `created_at` | server | `INTEGER NOT NULL` | epoch ms |

Index: `idx_agent_turns_run (run_id, id)`, `idx_agent_turns_user (user_id, created_at)`.

**Same-file conflict (orchestrator tuple — do not invent a fourth `kind`):** `role='orchestrator'`, `kind='produce'`, `reviewPass` = current pass (`1` on first produce, `2` if it happens during the fix pass), `outcome='ok'`, `difficultyKind='same-file-conflict'`. `feedback` = conflicting path(s); `decision` + `nextStep` = who goes first.

### HTTP

`{ run }` keys (camelCase of `AgentRunListRow`): `id`, `userId`, `sourceRequest`, `specSlug`, `status`, `latestRole`, `latestKind`, `latestReviewPass`, `latestOutcome`, `latestNextStep`, `tokensInSum`, `tokensOutSum`, `turnCount`, `createdAt`, `updatedAt`.

`{ turn }` keys (camelCase of `AgentTurnRow`): `id`, `runId`, `userId`, `role`, `kind`, `reviewPass`, `outcome`, `goal`, `changes`, `nextStep`, `feedback`, `decision`, `difficultyKind`, `tokensIn`, `tokensOut`, `createdAt`.

| Field | Source | Type | Notes |
|---|---|---|---|
| `POST /api/runs` | orchestrator | JSON | **Required:** `sourceRequest`. **Optional:** `specSlug`. Trim `sourceRequest`; empty → 400. **201** `{ run }` (new row: `status='running'`, all `latest*` null, `tokensInSum`/`tokensOutSum` null, `turnCount` 0). |
| `GET /api/runs` | orchestrator | JSON | camelCase wrap of `listAgentRuns`. **200** `{ runs }`. Pages still import `lib/db.ts`, not this GET. **401** if logged out. |
| `GET /api/runs/:id` | orchestrator | JSON | camelCase wrap of `getAgentRun`. **200** `{ run, turns }`. **404** if missing / other user. |
| `POST /api/runs/:id/turns` | orchestrator | JSON | **Required:** `role`, `kind`, `reviewPass`, `outcome`. **Optional:** `goal`, `changes`, `nextStep`, `feedback`, `decision`, `difficultyKind`, `tokensIn`, `tokensOut`. Allowed when run is `passed` or `stopped`. **201** `{ turn }`. Updates parent `latest_*` and `updated_at`. `outcome='stop'` sets run `status='stopped'`. |
| `PATCH /api/runs/:id` | orchestrator | JSON | **Optional:** `status` (`passed` \| `stopped` only), `specSlug`. At least one key required; empty body → 400 `欄位不正確`. **200** `{ run }`. |
| `GET /runs` | UI | RSC | `listAgentRuns` + `countAgentRunsByStatus`. Zero rows → empty card only. |
| `GET /runs/[id]` | UI | RSC | `getAgentRun`. Unknown / other user → `找不到這筆執行。` + `← 需求執行`. |

**UI copy (do not invent alternatives):**

| Key | Copy |
|---|---|
| Page title | 需求執行 |
| List blurb | 每次產品需求的角色迴圈（編排器、PM、QA、前端、後端）記在你的帳號。這裡的 token 是 Cursor 子代理用量；練習口說的 Gemini token 仍在用量統計。 |
| Hero tile | 進行中 (count, `text-clay`) |
| Other tiles | 已完成 / 已停止 / 已知 token |
| Status chips | 進行中 / 已完成 / 已停止 — static `rounded-md bg-surface-2`; 已停止 may use `bg-clay-wash text-clay` |
| Stage line | `尚未開始` if `latest_role` is NULL; else `{roleLabel} · {kindLabel} · 第 {reviewPass} 次` |
| roleLabel | 編排器 / PM / QA / 前端 / 後端 |
| kindLabel | 產出 / 審查 / 修復 |
| outcomeLabel | 通過 / 必須修正 / 停止 / 完成 / 錯誤 |
| Difficulties heading | 遇到的困難 |
| difficulty labels | 必須修正 / 停止後剩餘問題 / 同一檔衝突 |
| Decisions heading | 決策 |
| Decision / Next | 決策 / 下一步 |
| Token line | `輸入 {in} · 輸出 {out}` (`font-mono`; NULL → —) |
| User menu / settings menu | 需求執行 |
| Back link | ← 回首頁 (list); ← 需求執行 (detail) |
| Unknown run | `找不到這筆執行。` |
| Empty list | `還沒有任何需求執行紀錄。` |

Retry cap (skill, not a third pass): `review_pass` is only 1 or 2. There is no `3`.

## Errors

| Case | User-visible | API / log |
|---|---|---|
| No session on `/runs` | Redirect `/login?redirect=/runs` (or `/runs/<id>`) | proxy; no D1 |
| No session on `/api/runs*` | — | **401** `{ "error": "請先登入" }` |
| Missing `sourceRequest`, or empty after trim | — | **400** `{ "error": "需求內容是空的" }` |
| Invalid JSON | — | **400** `{ "error": "請求格式錯誤" }` |
| Invalid `role` / `kind` / `outcome` / `status` / `difficultyKind` / `reviewPass`; empty PATCH body; `specSlug` length > 128 | — | **400** `{ "error": "欄位不正確" }` |
| `tokensIn` / `tokensOut` present but not an integer ≥ 0 (includes strings; do not coerce) | — | **400** `{ "error": "token 必須是整數或空值" }` |
| Run id missing or other user’s | `找不到這筆執行。` + `← 需求執行` | **404** `{ "error": "找不到這筆執行" }` |
| Text contains `API_KEY=` or `CLIENT_SECRET=` or `BETTER_AUTH_SECRET=` or `ELEVENLABS_API_KEY=` | — | **400** `{ "error": "內容含有密鑰，未寫入" }`. Do **not** persist, do **not** write `api_logs`, do **not** echo the body. |
| D1 write failure | Detail/list stay on last good RSC render; POST caller sees error | **500** `{ "error": "寫入失敗" }` generic; no schema dump, no secret |

## Non-goals

- Not a ninth conversation scenario; no edits to public scenario `id`s or [`docs/SCENARIOS.md`](../SCENARIOS.md).
- Do not merge this stream into `api_calls` / `api_logs` / `/usage` Gemini totals.
- Do not add `node:sqlite`, a second DB file, or migrations other than `0005_*.sql`.
- Do not invent a machine token / PAT for the orchestrator this round (session cookie + `getCurrentUser()` only). Google Console / `wrangler secret` stay human and out of the spec.
- Do not store `.env.local`, `.dev.vars`, or secret **values**. Do not commit those files.
- Do not estimate tokens. Missing / null tokens are stored as NULL, not a 400. Do not store `review_pass` 3 (retry cap is two reviews).
- Should-fix does not create a difficulty row/kind and does not start a fix round.
- No websockets, no USD cost, no pagination of runs in v1 (list cap 50 newest).
- PM does not write product code or the skill file. Frontend does not edit `app/api/`, `migrations/`, or `docs/DATA.md`. Backend does not edit `app/runs/**` or `docs/DESIGN.md` (this spec needs **no** new tokens). **Frontend edits `proxy.ts` matcher only for this feature;** backend does not touch `proxy.ts`.
- Skill file update is **orchestrator after FE/BE land**, not part of PM/FE/BE file ownership.

## Handoff

- Goal: Logged-in owners can watch each Cursor multi-role feature loop in D1 — stage (`尚未開始` before the first turn), Must-fix / STOP / same-file difficulties, decisions + Next Step, and nullable subagent tokens — on `/runs` and `/runs/[id]`, isolated from Gemini `api_calls`. Pages read snake_case helpers from `lib/db.ts`; APIs wrap the same fields in camelCase.
- Changes: `docs/specs/agent-loop-board.md` (produce 2: M1 `/usage` db helpers + named `{ run }`/`{ turn }` keys; M2 list/stage/tiles/unknown-id copy; Should-fix 1–9). No `docs/SCENARIOS.md`.
- Next Step: QA spec review 2 (`qa` subagent)
