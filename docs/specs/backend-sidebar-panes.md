# Spec: Backend sidebar panes

- Slug: `backend-sidebar-panes`
- Status: draft
- Source request: 1.把 需求執行 移除 2.依照大標題 Gemini API key / 家教的聲音 / 用量統計 / ＡＰＩ呼叫記錄 / 音色目錄 / ＴＴＳ測試 / 開發者工具 於左側建立 side bar 點擊後會在中間做不切換頁面的動態切換內容

## Background

[`/backend`](../../app/backend/page.tsx) is a gated operator page ([`docs/specs/backend-settings-page.md`](./backend-settings-page.md)). Compact `SiteHeader` + stacked [`SettingsPanel`](../../components/settings-panel.tsx): Gemini key, 家教的聲音, **外觀**, then **operator `Link`s** to `/runs` `/usage` `/logs` `/voices` `/tts`, plus `IS_DEV` Next.js DevTools. Those tools today live on separate RSC pages. There is **no** `GET /api/usage` or `GET /api/logs`. Voices already have `/api/voices` + `/api/characters`. TTS tester is already a client component.

Signed-in [`UserMenu`](../../components/user-menu.tsx) still has **需求執行** → `/runs` (after 用量統計, before 後台).

Operators want `/backend` to stay **one URL**: a **left sidebar** + **center pane** that swaps content **without** `router.push` to `/usage` `/logs` `/voices` `/tts` `/runs`. **需求執行** leaves 後台 and the avatar menu. `/runs` and board APIs stay for agents.

This spec does **not** invent a ninth scenario, change public scenario `id`s, or put secret **values** in D1, logs, or this file. Known env **names** may appear. [`docs/SCENARIOS.md`](../SCENARIOS.md) is untouched. UI follows [`docs/DESIGN.md`](../DESIGN.md): tokens only, no hex, no `dark:`.

## User stories

1. As a logged-in operator on `/backend`, I want a left sidebar of the seven (or six in production) tool names so I can switch the center content without leaving the page.
2. As a logged-in operator, I want **需求執行** gone from 後台 and from the avatar menu so that board is not an in-app operator destination.
3. As a logged-in operator, I want 外觀 (淺色 / 深色 / 跟隨系統) inside **家教的聲音** so the sidebar is not an eighth item.
4. As a logged-in operator, I want 用量 / 紀錄 / 音色 / TTS to work inside the center pane (filters and log pages included) while the path stays `/backend`.
5. As a production visitor, I want **開發者工具** absent from the sidebar.

## Acceptance criteria

- [ ] **AC1 (sidebar + in-pane switch, path stays `/backend`):** Gated `/backend` (auth unchanged: `proxy.ts` matcher already includes `/backend`; page still `getCurrentUser()` + `redirect("/login")`). Compact `SiteHeader` stays. `h1` **後台** (`font-display text-[36px] sm:text-[44px]` leading-tight, tracking as today).

  **Lead (exact):** **在左側選項目來調整 Gemini key、家教聲音與外觀，或查看用量、紀錄、音色目錄與 TTS。Gemini key 與聲音偏好只存在這個瀏覽器，不會寫進資料庫。**

  Document title stays **後台 — Fluently**.

  Layout (DESIGN tokens only; **no** hex / `rgb()` / `dark:`):
  - Page container **`max-w-6xl`** (sidebar + main; wider than today’s `max-w-3xl` is required). Horizontal padding remains `px-5 sm:px-8`. Enter `.rise`.
  - Below the lead: `flex flex-col gap-6 lg:flex-row lg:gap-8`.
  - **Left sidebar:** `nav` `aria-label="後台"`; `w-full lg:w-56 lg:shrink-0`; on `lg` add `lg:border-r lg:border-line/70 lg:pr-6`. Items are **`button`s**, not `Link`s to `/usage` `/logs` `/voices` `/tts` `/runs`.
  - Nav item: `rounded-lg px-3 py-2 text-[13px]` (DESIGN §4 Nav). **Inactive:** `text-ink-soft hover:bg-surface-2 hover:text-ink`. **Active:** `bg-surface-2 text-ink` plus `aria-current="true"`.
  - **Center:** `min-w-0 flex-1`. Selected pane’s visible title is an `h2` whose text **equals the sidebar label** (`font-display text-[28px] sm:text-[32px]`). Inactive panes are not visible (unmount or `hidden`; either is fine).

  **Sidebar labels (exact Traditional Chinese, this order):**

  1. **Gemini API key**
  2. **家教的聲音**
  3. **用量統計**
  4. **API 呼叫紀錄** (紀錄, not 記錄)
  5. **音色目錄**
  6. **TTS測試**
  7. **開發者工具** — **only when `IS_DEV`**. Omit the item entirely in production. If a leftover hash `#devtools` is opened in production, show **Gemini API key**.

  **Default selected:** **Gemini API key** (password field + **儲存** visible on first paint).

  **Observable switch (required):** Clicking a sidebar item changes the center `h2` + body **without** a Next.js navigation to another pathname. After each click, `window.location.pathname === "/backend"`. **Forbidden:** `router.push` / `<Link href>` to `/usage` `/logs` `/voices` `/tts` `/runs` as the way to show those tools inside 後台. Grep the 後台 shell **and every body mounted on `/backend`**: zero `href="/runs|/usage|/logs|/voices|/tts"` except the allowed exits in AC5 (`/scenarios`, `/chat/...`).

  **URL:** React state is the source of truth. Hash is **optional** (`#gemini-key` `#voice` `#usage` `#logs` `#voices` `#tts` `#devtools`). If hash is used, update it with `location.hash` / `replaceState` — still pathname `/backend`. Invalid or empty hash → Gemini API key. Reload without hash → Gemini API key.

  Same frontend commit updates [`docs/DESIGN.md`](../DESIGN.md) **§7** (`/backend` = sidebar + center panes; list the new shell / extracted bodies) **and** a **後台 sidebar** recipe in **§6** (tokens, `max-w-6xl`, `gap-6 lg:gap-8`, `lg:w-56`, active `bg-surface-2`). No new colour tokens.

- [ ] **AC2 (remove 需求執行 from 後台 and UserMenu):** After this change:
  - `/backend` has **no** **需求執行** label and **no** link to `/runs`.
  - Signed-in [`UserMenu`](../../components/user-menu.tsx): **delete** the **需求執行** → `/runs` item. Remaining signed-in items: **開始練習**, **用量統計** (still → `/usage`, standalone page), **後台** → `/backend`, **登出**. Signed-out still **登入** only.
  - **Do not** delete `app/runs/**`, `app/api/runs/**`, or board tables. Agents may still `POST /api/runs`. Direct `/runs` stays gated.

- [ ] **AC3 (Gemini API key + 家教的聲音 panes reuse SettingsPanel; 外觀 folds in):** No eighth nav item. **外觀** is **not** a sidebar row.

  Extract / reuse today’s SettingsPanel **sections** (hydrate on mount from [`lib/settings.ts`](../../lib/settings.ts) / [`lib/theme.ts`](../../lib/theme.ts): `getApiKey` / `getVoiceSource` / `getVoiceName` / `getAutoSpeak` / `readStoredTheme`). Empty first paint must **not** wipe `fluently-gemini-key`. `/backend` **never** collects `ELEVENLABS_API_KEY`. Keys **never** D1 / logs.

  - **Gemini API key** pane: same password input (placeholder `AIza…`), **儲存** (checking **驗證中**). Empty save after hydrate (user cleared the field) → **已清除** + `setApiKey("")`. `POST /api/key-check` with `x-gemini-key` (do not change the route). Success **已驗證，可以開始對話**; failure API `message` or **驗證失敗**; network **無法連線到伺服器**. Idle hint (exact): **伺服器已有 key 時這裡可以留空。貼上的 key 只存在這個瀏覽器，不會寫進資料庫。** plus **申請 key** → `https://aistudio.google.com/apikey`.
  - **家教的聲音** pane: existing segmented **角色** / **Gemini** / **系統**, Gemini `<select>` + blurbs, **自動朗讀家教回覆**, browser-unsupported line — **exact copy as today**. Then, in the **same pane**, the **外觀** sublabel + segmented **淺色** / **深色** / **跟隨系統** (`storeTheme` + `applyTheme`; DevTools overlay theme patch when `IS_DEV`). Root layout theme-boot is unchanged (non-goal to rework).

  Remove the stacked operator `Link` list from SettingsPanel (replaced by AC1 sidebar).

- [ ] **AC4 (開發者工具 pane, `IS_DEV` only):** When `IS_DEV`, sidebar item **開發者工具** shows today’s DevTools block in the center: muted **Next.js 開發者工具** + `dev only` chip, 指示器位置 / 指示器大小, **隱藏指示器 24 小時** / **已隱藏（重新整理生效）**, and the existing muted note about `npm run dev` memory. Load DevTools config on shell mount when `IS_DEV` (not only when the pane is opened, same as today’s page). Production build: **zero** **開發者工具** in the sidebar and no DevTools form in the DOM.

- [ ] **AC5 (in-pane bodies + data; choose GET JSON APIs):** Switching must be observable with real tool UI, not placeholders.

  **Choice: (b) new GET JSON APIs** for usage and logs. Frontend does **not** import `lib/db.ts` from client components. Standalone `/usage` `/logs` `/voices` `/tts` **may remain** for direct URLs (chrome, back links, RSC fetch as today). Prefer extracting presentational bodies so both the standalone page and the `/backend` pane render the same inner UI.

  **One field shape (bodies = GET JSON):** Usage and logs bodies accept **exactly** the **Usage / logs JSON = body props** table (one list; same names as the GETs). Do not add a second snake_case prop shape. `fillDays` / bars / `LogRow` read `totalTokens`, `durationMs`, `sessionId`, `requestedAt`, `returnedAt`, `ok: boolean`, not `total_tokens` / `duration_ms` / `session_id` / `ok` as `0|1`. Standalone `/usage` and `/logs` **map** helper snake_case into that table, then render the same body. The `/backend` pane passes `GET` JSON through **unchanged**. Bodies **must not** import `ApiLog`, `UsageTotals`, `DailyUsage`, or other types from `lib/db.ts`.

  **用量統計 pane — drop the whole 「API 呼叫紀錄」 block (A):** The pane shows tiles, 14-day bars, 各情境 table, 最近的對話 only. It **omits** today’s usage-page 「API 呼叫紀錄」 section in full: summary chips, **還沒有任何 API 呼叫。** well, **and** **看完整紀錄（可篩選、搜尋、展開全文）→**. Logs live in the **API 呼叫紀錄** sidebar pane. Empty usage is **only** **還沒有任何對話紀錄。** + **去練一段對話**. `GET /api/usage` may still return `logCount` / `logSummary` (loader parity); the pane does not render them. Standalone `/usage` **keeps** the summary block **and** the `/logs` link.

  | Pane | How the center gets data | Presentational reuse |
  |---|---|---|
  | 用量統計 | Client fetch **`GET /api/usage`** on first select (and if the operator returns after a failed load, retry on select). | Extract body from `app/usage/page.tsx` (tiles, 14-day bars, 各情境 table, 最近的對話) on the shared camelCase props. **No** logs-summary block in the pane (A above). |
  | API 呼叫紀錄 | Client fetch **`GET /api/logs`** with `op` / `status` / `q` / `page` on the **API** query string. Filters, search, and **← 上一頁** / **下一頁 →** stay **inside the pane** (**buttons / in-pane `onSubmit` form** — **not** `<Link href="/logs?…">`, **not** `<form action="/logs">`). They must **not** navigate to `/logs` or write `?op=` onto `/backend`. Empty filter result: **沒有符合條件的紀錄。** | Extract list/rows (`<details>` expand) from `app/logs/page.tsx` on the shared camelCase props (`durationMs`, `ok: boolean`, …). Standalone `/logs` **keeps** URL query + RSC Links + `form action="/logs"` (DATA.md §3.5). |
  | 音色目錄 | Existing **`GET /api/voices`** + **`GET /api/characters`** on select; render [`VoiceCatalog`](../../components/voice-catalog.tsx). Do **not** rewrite catalog REST. | Same component as `/voices`. |
  | TTS測試 | `/backend` **RSC** reads `configured = Boolean(process.env.ELEVENLABS_API_KEY?.trim())` and `await defaultVoiceId()`, passes into the client shell. Render [`ElevenLabsTtsTester`](../../components/elevenlabs-tts-tester.tsx). No new ElevenLabs GET. Empty-well **音色目錄** in the **pane**: a control that **selects the 音色目錄 sidebar pane** (client callback, e.g. `onOpenVoiceCatalog`). Path stays `/backend` — **not** `href="/voices"`. Standalone `/tts` **keeps** `href="/voices"`. | Same tester; optional callback only when mounted on `/backend`. |

  Pane `h2` = sidebar label. Under it, reuse standalone **lead** copy for 用量 / 紀錄 / 音色 / TTS (TTS standalone `h1` stays **ElevenLabs TTS** on `/tts`; in-pane `h2` is **TTS測試**).

  **Pane chrome (must stay on `/backend`):** Pane bodies **omit** standalone page chrome: **← 回首頁**, **← 用量統計**, `/tts` header **← API 呼叫紀錄** and **音色目錄** `Link`s, usage **看完整紀錄… →**, `<form action="/logs">`, filter/pagination `Link`s to `/logs`. Those stay on the standalone pages only.

  **Allowed exits from a `/backend` pane:** **去練一段對話** → `/scenarios`; usage session cards → `/chat/[id]?session=`. Nothing else may navigate away (including TTS empty-well **音色目錄** and logs filters).

  Loading (usage / logs / voices): **載入中…** (`text-[13px] text-ink-muted`). Fetch error: API `error` or **無法連線到伺服器**. Empty usage: **還沒有任何對話紀錄。** + **去練一段對話** → `/scenarios`. Empty logs (`grandTotal === 0`): **還沒有任何 API 呼叫。** + **去練一段對話** → `/scenarios`.

- [ ] **AC6 (GET `/api/usage` + GET `/api/logs`; DATA.md; no catalog rewrite):** Backend adds two JSON GETs. Each method: `getCurrentUser()`; failure **401** `{ "error": "請先登入" }` (same as voices). Filter by `user.id` (`user_student_id`). Reuse existing `lib/db.ts` helpers; **do not** change helper signatures; **do not** merge `api_calls` / `api_logs`; **do not** estimate tokens; **do not** log key values. No new tables / migrations. **Do not** rewrite `/api/voices*` `/api/characters*` `/api/runs*` `/api/elevenlabs`.

  Response JSON **is** the shared body-prop shape in **Frontend / backend fields** (one list; AC5 bodies and these GETs use the same names). Backend maps helper snake_case → that camelCase in the route. Do not return snake_case to the client.

  **`GET /api/usage`** → **200** `{ totals, chat, tts, byScenario, sessions, logCount, logSummary, daily, scenarios }` where the aggregates match today’s `/usage` loader (`getTotals(user.id)`, `getTotals(..., "chat")`, `getTotals(..., "tts")`, `getUsageByScenario`, `getRecentSessions`, `countLogs(user.id, {})`, `getLogSummary`, `getDailyUsage(user.id, 14)`). `daily` is the **raw** helper rows (frontend `fillDays` stays in the extracted usage body, `DAYS = 14`, reading `totalTokens` not `total_tokens`). `scenarios` is **only** `{ id, emoji, title, titleZh }` for ids referenced by `byScenario` + `sessions` (no `persona` / goals).

  **`GET /api/logs`** query: `op` (optional operation string), `status` (`ok` \| `failed`; anything else ignored), `q` (trim; empty omitted), `page` (integer ≥ 1; clamp like `/logs`). `PAGE_SIZE = 25`. → **200** `{ logs, total, grandTotal, page, pages, operations, summary }` using `getLogs` / `countLogs` / `getLogOperations` / `getLogSummary`. `total` = filtered count; `grandTotal` = `countLogs(user.id, {})`; `pages = max(1, ceil(total / 25))`; `page` = clamped current. `summary` is `logSummary[]`. `operations` = `string[]`.

  Upstream / DB throw: **500** `{ "error": "無法讀取用量" }` or `{ "error": "無法讀取呼叫紀錄" }` — no SQL, no secrets.

  Same backend commit updates [`docs/DATA.md`](../DATA.md):
  - `/backend` is a **sidebar + center-pane** operator shell; pathname stays `/backend`; **需求執行** is **not** linked from 後台 or UserMenu; `/runs` + `GET/POST /api/runs*` still exist for agents.
  - Document `GET /api/usage` and `GET /api/logs` (camelCase, session-gated).
  - Standalone `/logs` still uses URL query + RSC; the 後台 pane uses `GET /api/logs`. Observation UI is **both** `/logs` **and** the 後台 **API 呼叫紀錄** pane. `/usage` page remains; 後台 **用量統計** pane reads `GET /api/usage`.
  - Do **not** put key **values** in DATA.md.

  Do **not** edit [`docs/SCENARIOS.md`](../SCENARIOS.md).

## Frontend / backend fields

| Field | Source | Type | Notes |
|---|---|---|---|
| Selected pane | UI client state (hash optional) | union of the 6/7 sidebar ids | Default Gemini API key. Not D1. |
| Gemini API key | UI pane / `localStorage` `fluently-gemini-key` | `string` | `x-gemini-key` on `POST /api/key-check`. **Never D1 / logs / spec values.** |
| `voiceSource` | UI / `fluently-voice-source` | `"elevenlabs" \| "gemini" \| "browser"` | Default elevenlabs. |
| `voiceName` | UI Gemini select / `fluently-voice-name` | `string` | Gemini `VOICES` id. |
| `autoSpeak` | UI toggle / `fluently-auto-speak` | `boolean` | `"on"` / `"off"`; default on. |
| `theme` | 家教的聲音 pane / `fluently-theme` | `"light" \| "dark" \| "system"` | Folded 外觀; not a nav item. |
| DevTools corner / scale / hide | 開發者工具 pane when `IS_DEV` | existing `lib/devtools.ts` | Omitted in production sidebar. |
| Usage aggregates | `GET /api/usage` / standalone map | camelCase below | `user_student_id = user.id`. Pane does not render `logCount` / `logSummary`. |
| Log list / filters | `GET /api/logs?op&status&q&page` / standalone map | camelCase below | Filters are API query, not `/backend` searchParams. |
| Voices / characters | existing GET `/api/voices` `/api/characters` | existing camelCase | No rewrite. |
| TTS `configured` / `voiceId` | `/backend` RSC props | `boolean` / `string \| null` | `ELEVENLABS_API_KEY` presence only; value never to client. |
| TTS empty-well 音色目錄 | pane: client select 音色目錄; `/tts`: `href="/voices"` | callback or `Link` | Pane must not navigate to `/voices`. |
| Session cookie | proxy + `getCurrentUser()` | cookie | Gate `/backend` and the new GETs. |
| `ELEVENLABS_API_KEY` | env / Worker secret only | — | **Not** a field on `/backend`. |

No new D1 columns.

### Usage / logs JSON = body props (specify once)

This is the **only** field list for `GET /api/usage`, `GET /api/logs`, and the extracted usage/logs bodies. Standalone pages map helper snake_case → these names (`prompt_tokens` → `promptTokens`, `avg_latency` → `avgLatency`, `scenario_id` → `scenarioId`, `created_at` → `createdAt`, `updated_at` → `updatedAt`, `avg_ms` → `avgMs`, `session_id` → `sessionId`, `user_student_id` → `userStudentId`, `input_tokens` → `inputTokens`, `output_tokens` → `outputTokens`, `total_tokens` → `totalTokens`, `thought_tokens` → `thoughtTokens`, `requested_at` → `requestedAt`, `returned_at` → `returnedAt`, `duration_ms` → `durationMs`, `ok` `0\|1` → `ok` boolean).

**`GET /api/usage` 200 / usage-body props**

| Object | Fields |
|---|---|
| `totals` / `chat` / `tts` | `calls`, `sessions`, `promptTokens`, `outputTokens`, `thoughtTokens`, `totalTokens`, `avgLatency`, `failures` |
| `byScenario[]` | `scenarioId`, `calls`, `sessions`, `totalTokens`, `promptTokens`, `outputTokens` |
| `sessions[]` | `id`, `scenarioId`, `createdAt`, `updatedAt`, `turns`, `totalTokens` |
| `logSummary[]` | `operation`, `platform`, `calls`, `failures`, `avgMs`, `totalTokens` |
| `daily[]` | `day`, `calls`, `totalTokens` |
| `scenarios[]` | `id`, `emoji`, `title`, `titleZh` |
| top-level | `logCount` (number), `logSummary` (above). Pane ignores both. |

**`GET /api/logs` 200 / logs-body props**

| Object | Fields |
|---|---|
| top-level | `logs`, `total`, `grandTotal`, `page`, `pages`, `operations` (`string[]`), `summary` (`logSummary[]`) |
| `logs[]` | `id`, `platform`, `endpoint`, `operation`, `model`, `detail`, `sessionId`, `userStudentId`, `input`, `output`, `inputTokens`, `outputTokens`, `totalTokens`, `status`, `ok` (**boolean**, `ok === 1`), `error`, `requestedAt`, `returnedAt`, `durationMs` |

### File ownership (avoid same-file edits)

| Owner | Paths |
|---|---|
| Frontend | `app/backend/**` (RSC chrome + TTS props into shell), new client shell (e.g. `components/backend-shell.tsx`), `components/settings-panel.tsx` (reuse sections; drop operator links; fold 外觀 into 家教的聲音), `components/user-menu.tsx` (remove 需求執行), extracted usage/logs bodies (shared camelCase props; standalone pages map snake_case) + wire `app/usage/page.tsx` / `app/logs/page.tsx` (standalone **keeps** back-links, logs URL form, usage logs-summary + `/logs` link), `components/elevenlabs-tts-tester.tsx` (optional pane callback for 音色目錄; `/tts` keeps `href="/voices"`), `docs/DESIGN.md` §6 + §7. May **read** existing `/api/voices` `/api/characters` `/api/usage` `/api/logs`. **Must not** edit `app/api/**`, `lib/db.ts`, `docs/DATA.md`. |
| Backend | `app/api/usage/route.ts` (`GET` only), `app/api/logs/route.ts` (`GET` only), `docs/DATA.md` (sidebar shell, no `/runs` on 後台/UserMenu, new GET contracts). Map snake_case helpers → camelCase in the route. **Must not** rewrite catalog REST, delete `/runs` or `/api/runs*`, or edit `components/**` / `app/backend/**` / `docs/DESIGN.md`. |

If both roles would need the same file, **stop** and write it in Next Step — do not dual-edit.

## Errors

| Case | User-visible | API / log |
|---|---|---|
| No session `GET /backend` | Redirect `/login?redirect=/backend` | proxy; no API body |
| Cookie present but invalid on page | Redirect `/login` | `getCurrentUser()` |
| No session `GET /api/usage` or `GET /api/logs` | (pane) API `error` **請先登入** | **401** `{ "error": "請先登入" }` |
| Usage/logs/voices network error | **無法連線到伺服器** | client catch |
| Usage/logs DB failure | pane shows API `error` | **500** `無法讀取用量` / `無法讀取呼叫紀錄`; no secrets |
| Empty usage | **還沒有任何對話紀錄。** | 200 with zero totals |
| Empty logs (`grandTotal === 0`) | **還沒有任何 API 呼叫。** | 200 |
| Logs filters match nothing | **沒有符合條件的紀錄。** | 200 `logs: []`, `total: 0` |
| Empty Gemini key save after hydrate | **已清除** | no `/api/key-check` on blank first paint |
| Key verify success | **已驗證，可以開始對話** | existing `POST /api/key-check` |
| Key verify failure | API `message` or **驗證失敗** | existing; no secret in logs |
| Key verify network | **無法連線到伺服器** | client catch |
| Browser TTS unavailable | **此瀏覽器不支援語音合成，回覆只會以文字顯示。** | none |
| `#devtools` in production | Gemini API key pane; no 開發者工具 item | none |
| `ELEVENLABS_API_KEY` missing | TTS tester existing empty/error (unchanged) | unchanged `/api/elevenlabs` |
| Signed-out UserMenu | **登入** only; no 後台 / 需求執行 | none |

## Non-goals

- A ninth scenario, any public scenario `id` change, or edits to [`docs/SCENARIOS.md`](../SCENARIOS.md).
- Deleting `/runs`, board APIs, or `agent_runs` / `agent_turns`. Agents may still POST `/api/runs`.
- Removing standalone `/usage` `/logs` `/voices` `/tts` (direct URLs stay).
- An eighth sidebar item for 外觀 or 需求執行.
- New D1 tables/migrations, catalog REST rewrite, or collecting `ELEVENLABS_API_KEY` in the browser.
- Changing `POST /api/key-check`, chat/review/speak, `lib/settings.ts` storage keys, or auth/session.
- `router.push` / in-pane `Link` to `/usage` `/logs` `/voices` `/tts` `/runs` as the 後台 content switcher. Allowed pane exits: `/scenarios`, `/chat/...` only.
- Admin role separate from “any signed-in user”.
- Dark-mode `dark:` classes or new colour tokens.
- Putting keys in D1 or `api_logs`.

## Handoff

- Goal: Turn `/backend` into a left-sidebar operator shell that swaps center panes without leaving `/backend`, drop 需求執行 from 後台 and UserMenu, and fold 外觀 into 家教的聲音.
- Changes: `docs/specs/backend-sidebar-panes.md` (QA Must-fix 1–3)
- Next Step: QA spec review `review_pass: 2` (`qa` subagent)
