# Spec QA: backend-sidebar-panes

- Slug: `backend-sidebar-panes`
- review_pass: **2** (diff review, frontend only)
- Result: **PASS**
- Spec: [`docs/specs/backend-sidebar-panes.md`](./backend-sidebar-panes.md)
- Scope: Re-read `components/backend-shell.tsx` after frontend Must-fix 1. Backend already **PASS**. No product code.

Must-fix: **none**. Should-fix does not start another produce.

---

## Must-fix: none

| Pass-1 Must-fix | Owner | Result |
|---|---|---|
| 1. Usage / logs / voices network/parse copy | frontend | PASS — shared `fetchJson`: `fetch` throw and 200 JSON parse `catch` → **無法連線到伺服器**; `!res.ok` → `readApiError` (`data.error` or **無法連線到伺服器**). `UsagePane` / `LogsPane` / `VoicesPane` set `result.error` only. No `err.message` on those paths. |

---

## Should-fix (do not produce, do not STOP)

1. `ElevenLabsTtsTester` still contains `href="/voices"` for the `/tts` branch. Rendered `/backend` pane uses `onOpenVoiceCatalog` (no navigation). Diff-review grep is the **rendered** pane, not a ban on that standalone branch in the same file.
2. Pane title `h2` matches the sidebar label; `UsageBody` / `VoiceCatalog` still render extra section `h2`s underneath (`每日 token 用量`, `新增音色`, …). Harmless; not an eighth nav item.
3. `useSyncExternalStore` server snapshot is always Gemini API key. Reload of `/backend#usage` (etc.) hydrates Gemini first, then the hash pane.
4. Log `id` is a **number**; `model` / `detail` / `sessionId` / `userStudentId` / `input` / `output` / `error` are `string \| null`. `GET /api/usage` `sessions` uses helper default **limit 12**. Shell `max-w-6xl`; 音色 / TTS inner `max-w-3xl`. AC1 h1 tracking is `tracking-[-0.02em]`.

---

## Checked (AC1–AC6)

| Topic | Result | Notes |
|---|---|---|
| AC1 sidebar + path | PASS | Compact header, `h1` **後台**, exact lead, title **後台 — Fluently**, `max-w-6xl`, `px-5 sm:px-8`, `.rise`, `nav aria-label="後台"`, `lg:w-56` buttons, active `bg-surface-2` + `aria-current="true"`, pane `h2` = label, hash via `replaceState` (pathname `/backend`), default Gemini + **儲存**, labels/order exact, `#devtools` prod → Gemini. DESIGN §6 sidebar recipe + §7 shell/bodies. No hex / `rgb()` / `dark:` on new UI. |
| AC2 需求執行 | PASS | Gone from `/backend` and UserMenu. Signed-in: **開始練習**, **用量統計** → `/usage`, **後台** → `/backend`, **登出**. Signed-out: **登入**. `/runs` + `GET/POST /api/runs*` remain. |
| AC3 外觀 | PASS | No eighth row. 外觀 淺色/深色/跟隨系統 inside **家教的聲音**. Gemini pane copy + `POST /api/key-check`. Empty first paint does not `setApiKey`. No `ELEVENLABS_API_KEY` field. Operator `Link` list removed from settings-panel. |
| AC4 開發者工具 | PASS | Sidebar item + form gated by `IS_DEV` (`process.env.NODE_ENV`). Config loaded on shell mount. Prod: no item, no form in DOM; leftover `#devtools` → Gemini. |
| AC5 panes + data | PASS | Client GET `/api/usage` + `/api/logs`; bodies camelCase, no `lib/db.ts` types. Usage pane omits 「API 呼叫紀錄」 chips / empty well / `/logs` link. Standalone `/usage` keeps summary + link. Logs filters are buttons / `onSubmit` (not `/logs` Links or `?op=` on `/backend`). TTS empty-well **音色目錄** selects the pane; `/tts` keeps `href="/voices"`. Allowed exits: `/scenarios`, `/chat/[id]?session=`. Chrome omitted from panes. Network/parse → **無法連線到伺服器**; non-OK JSON → API `error`. |
| AC6 APIs + DATA.md | PASS | `GET /api/usage` + `GET /api/logs` only. `getCurrentUser()` → **401** `{ "error": "請先登入" }`. 500 strings exact. Helper signatures unchanged (map snake_case → camelCase in the route). `ok: boolean`. `user.id` filter. No new migrations. Catalog / elevenlabs / runs not rewritten by these routes. DATA.md: sidebar shell, no `/runs` from 後台/UserMenu, both observation UIs, no key **values**. |
| Secrets | PASS | Env **names** only. Keys not in D1/logs/spec. `/backend` never collects ElevenLabs key; RSC passes `configured` boolean + `voiceId`. |
| Dual-edit | PASS | FE: `app/backend/**`, `backend-shell`, `settings-panel`, `user-menu`, bodies, `app/usage` / `app/logs`, tester callback, DESIGN. BE: `app/api/usage`, `app/api/logs`, DATA.md. No same-file overlap for this spec. |
| SCENARIOS | PASS | `docs/SCENARIOS.md` untouched. |

---

## Runnable checklist

Do **not** add a test framework. Do **not** commit `.env.local` / `.dev.vars`. Do **not** put key values in specs or DATA.md.

```bash
npm run build && npm run lint
```

Unauthenticated (proxy does **not** match `/api/usage` `/api/logs`; expect JSON 401, not a login HTML redirect):

```bash
# 307 /login?redirect=/backend
curl -sI http://localhost:3000/backend | grep -i location
# 401 {"error":"請先登入"}
curl -s -w '\n%{http_code}\n' http://localhost:3000/api/usage
curl -s -w '\n%{http_code}\n' http://localhost:3000/api/logs
```

Logged-in, browser `/backend`:

- [ ] Compact header, `h1` **後台**, exact AC1 lead, `max-w-6xl`, sidebar `nav aria-label="後台"`, default pane **Gemini API key** + **儲存**.
- [ ] Click each sidebar label (order: Gemini API key → 家教的聲音 → 用量統計 → API 呼叫紀錄 → 音色目錄 → TTS測試 → 開發者工具 if `IS_DEV`): center `h2` equals the label; `window.location.pathname === "/backend"`.
- [ ] Prod: no **開發者工具** item or form. `#devtools` → Gemini API key.
- [ ] **需求執行** gone from 後台 and UserMenu; `/runs` still loads when opened directly.
- [ ] **外觀** only inside **家教的聲音**, not a sidebar row. Empty Gemini save after hydrate → **已清除** (no `/api/key-check`).
- [ ] 用量統計 pane: tiles / bars / 各情境 / 最近的對話 only — **no** 「API 呼叫紀錄」 chips, empty well, or `/logs` link. Empty: **還沒有任何對話紀錄。** + **去練一段對話**.
- [ ] Usage/logs JSON camelCase (`totalTokens`, `durationMs`, `ok` boolean). Standalone `/usage` `/logs` map snake_case into the same bodies and keep chrome / logs URL form / usage summary + `/logs` link.
- [ ] Logs pane: filters/pagination do not navigate to `/logs` or add `?op=` on `/backend`. Empty filters: **沒有符合條件的紀錄。** `grandTotal === 0`: **還沒有任何 API 呼叫。**
- [ ] Disconnect the network (or block `/api/usage`) then open 用量統計 / API 呼叫紀錄 / 音色目錄: **無法連線到伺服器** (not `Failed to fetch`).
- [ ] TTS empty-well **音色目錄** selects the 音色目錄 pane; pathname stays `/backend`. `/tts` still `href="/voices"`.
- [ ] Rendered `/backend` pane: no operator-tool `href="/runs|/usage|/logs|/voices|/tts"` except `/scenarios` and `/chat/...`.
- [ ] `docs/DESIGN.md` §6 + §7 and `docs/DATA.md` GET contracts updated. `docs/SCENARIOS.md` untouched.

---

## Handoff

- Goal: Diff review pass 2 (frontend) of `/backend` sidebar panes after Must-fix 1.
- Changes: `docs/specs/backend-sidebar-panes-qa.md` (Must-fix cleared)
- Next Step: **review_pass: 2 · PASS** — frontend and backend both PASS. Should-fix does not start another produce.
