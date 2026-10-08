# Spec: Backend settings page

- Slug: `backend-settings-page`
- Status: draft
- Source request: 新增一個路由是 backend頁面 將右上角的設定規劃到 backend頁面裡面 然後移除 對話模式下 的 返回上一頁

## Background

Fluently operators today open a **gear popover** ([`components/settings-menu.tsx`](../../components/settings-menu.tsx)) from two headers:

- [`components/site-header.tsx`](../../components/site-header.tsx) — every page that uses `SiteHeader` (home, `/scenarios`, `/usage`, `/logs`, `/tts`, `/voices`, `/runs`, …)
- [`app/chat/[id]/page.tsx`](../../app/chat/[id]/page.tsx) — conversation header (mode picker, script, and live share this header)

The popover holds: Gemini key (browser `localStorage`, never D1 — [`docs/DATA.md`](../DATA.md) §4, [`lib/settings.ts`](../../lib/settings.ts)), 家教的聲音 (elevenlabs / gemini / browser + auto-speak), 外觀 theme, links to `/runs` `/usage` `/logs` `/voices` `/tts`, and an `IS_DEV` Next.js DevTools section. Theme is applied by an inline script in [`app/layout.tsx`](../../app/layout.tsx) plus a `useLayoutEffect` re-apply in `SettingsMenu` (React Strict Mode remount drops `<html>` attributes in dev). DESIGN documents that pair in [`docs/DESIGN.md`](../DESIGN.md) §2.

Gated operator pages already exist: `/tts`, `/voices`, `/usage`, `/logs`, `/runs`. Cookie gate is [`proxy.ts`](../../proxy.ts); real session is `getCurrentUser()` + `redirect("/login")`. [`docs/DATA.md`](../DATA.md) §1 lists those paths; `/backend` is not on that list yet.

Conversation header also has a `Link` `href="/scenarios"` whose visible text is only `←` (no label). That is the 返回上一頁. Script and live share this header with the mode picker ([`components/mode-picker.tsx`](../../components/mode-picker.tsx)). Other `←` links in the app (home, logs pagination, 再練一次) are **not** this control.

This spec:

1. Adds a logged-in **`/backend`** page that shows the settings **content as a normal page** (not a floating popover).
2. Removes the 設定 gear from `SiteHeader` and from the chat header. Learners on home / scenarios / chat no longer open a settings drawer from the top-right.
3. Adds **後台** → `/backend` in the signed-in [`UserMenu`](../../components/user-menu.tsx) so operators still have a path.
4. Removes the conversation-header `←` back chevron.

Do **not** invent a ninth scenario. Do **not** change public scenario `id`s (`cafe`, `directions`, `small-talk`, `hotel`, `clinic`, `phone-interview`, `interview`, `debate`). Do **not** put secrets, API keys, or Client Secrets in D1, logs, or this spec. Known env **names** may appear; **values** must not. [`docs/SCENARIOS.md`](../SCENARIOS.md) is untouched.

UI follows [`docs/DESIGN.md`](../DESIGN.md): tokens only, no hex, no `dark:`.

## User stories

1. As a logged-in operator, I want a `/backend` page (gated like `/tts` / `/voices`) so I can change Gemini key, tutor voice, theme, and reach operator tools without a header drawer.
2. As a learner on home, scenarios, or chat, I want the top-right gear gone so practice screens stay quiet.
3. As a signed-in operator, I want **後台** in the avatar menu so I can still open `/backend` after the gear is removed.
4. As a learner in conversation (mode picker, script, or live), I want the header `←` gone so I am not sent back to `/scenarios` by a chevron.
5. As any visitor, I want my saved theme to still apply on first paint and after Strict Mode remount, even when settings no longer mount in the header.

## Acceptance criteria

- [ ] **AC1 (auth + route + compact page):** New page **`/backend`** (English path). [`proxy.ts`](../../proxy.ts) `matcher` gains `/backend` and `/backend/:path*` (same cookie-only gate as `/tts`). **Frontend owns that matcher edit;** backend does not touch `proxy.ts`. Page loader calls `getCurrentUser()` and `redirect("/login")` if the cookie is present but invalid. Unauthenticated `GET /backend` → `/login?redirect=/backend`. No new API route. No D1 read/write on this page except the existing session check.
  - Compact `SiteHeader` (same as `/tts` / `/voices`). No 設定 gear on this header (AC2).
  - Page title **後台 — Fluently**. `h1` **後台** (`font-display text-[36px] sm:text-[44px]` leading-tight, tracking as `/tts`).
  - Lead (exact): **調整 Gemini key、家教聲音與外觀，並連到用量、紀錄、音色目錄與 TTS。這些偏好只存在這個瀏覽器，不會寫進資料庫。**
  - Container `max-w-3xl`; horizontal padding `px-5 sm:px-8`; enter with `.rise`. DESIGN tokens only. **No** bare hex / `rgb()`, **no** `dark:`. No new DESIGN tokens. Same frontend commit updates [`docs/DESIGN.md`](../DESIGN.md) §7 (new `/backend` page + any new component such as a settings panel or theme boot) **and** §2 (theme writers: keep the layout inline script; replace the `settings-menu.tsx` citation with the theme-boot that still remounts — see AC5).

- [ ] **AC2 (settings leave the headers):** After this change, grep `SettingsMenu` / `aria-label="設定"` / gear trigger: **zero** matches in `SiteHeader` and `app/chat/[id]/page.tsx`. The 設定 button is gone from:
  - `SiteHeader` on home, `/scenarios`, `/usage`, `/logs`, `/tts`, `/voices`, `/runs`, `/backend`, and any other page that uses it.
  - The chat header in `app/chat/[id]/page.tsx`.
  Learners on home / scenarios / chat cannot open a settings drawer from the top-right. Do **not** add `UserMenu` to the chat header (non-goal). Signed-in users on pages with `SiteHeader` reach `/backend` via AC3. Chat / live no-key state uses the in-page **後台** link in AC8 (not the gear, not UserMenu).

- [ ] **AC3 (UserMenu path):** Signed-in [`UserMenu`](../../components/user-menu.tsx) (avatar dropdown) gains a link **後台** → `/backend` (place it with the other signed-in links, after **需求執行**, before 登出). Clicking it navigates to `/backend` and closes the menu (same pattern as 開始練習). Keep existing items: 開始練習, 用量統計, 需求執行, 登出. Signed-out users still see **登入** only — no 後台 link. `/backend` remains gated (AC1). Do not leave operators with no in-app path to the page.

- [ ] **AC4 (page content = today’s settings, not a popover):** `/backend` shows the settings **content as a normal page**, not a floating popover (no gear trigger, no `.pop` absolute panel, no click-outside / Esc-to-dismiss for this content). Frontend may extract a non-popover panel from `settings-menu.tsx` or replace that file; DESIGN.md §7 must list whatever ships. Sections and copy that already exist must stay, including voice-catalog exact copy:
  - **Mount hydration (required):** Today the popover reads `getApiKey` / `getVoiceSource` / `getVoiceName` / `getAutoSpeak` only when it **opens**. `/backend` has no open event. On mount, hydrate `keyDraft`, `voiceSource`, `voiceName`, `autoSpeak`, and theme from [`lib/settings.ts`](../../lib/settings.ts) / [`lib/theme.ts`](../../lib/theme.ts) (same helpers: `getApiKey`, `getVoiceSource`, `getVoiceName`, `getAutoSpeak`, `readStoredTheme`) so the form shows stored values on first paint. Empty **儲存** → **已清除** + `setApiKey("")` **only** when the user actually clears the field after hydrate — a blank first paint must not wipe a stored `fluently-gemini-key`. Voice segmented / Gemini select / auto-speak toggle must show the stored source, not silent defaults.
  - **Gemini API key** — password input (placeholder `AIza…`), **儲存** (checking: **驗證中**). Empty save after hydrate (user cleared the field) → **已清除**. `POST /api/key-check` with `x-gemini-key` (existing; do not change the route). Success **已驗證，可以開始對話**; failure uses the API `message` or **驗證失敗**; network **無法連線到伺服器**. Idle hint (exact): **伺服器已有 key 時這裡可以留空。貼上的 key 只存在這個瀏覽器，不會寫進資料庫。** plus **申請 key** → `https://aistudio.google.com/apikey`. Key stays in `lib/settings.ts` (`fluently-gemini-key`). **Never D1, never logs.** `/backend` **never** collects `ELEVENLABS_API_KEY`.
  - **家教的聲音** — segmented **角色** / **Gemini** / **系統** (`elevenlabs` / `gemini` / `browser`) via `setVoiceSource`. Gemini: `VOICES` `<select>` + blurb **真人感語音，會消耗音訊 token（已計入用量）。同一句話重播不會重新產生，失敗時自動退回瀏覽器語音。** ElevenLabs blurb (exact, from voice-catalog): **角色音色走 ElevenLabs，由音色目錄指定。同一句重播不會再合成，失敗時退回瀏覽器語音。** Browser: **使用系統內建語音：免費、即時、不耗額度，但聽起來比較機械。** Toggle **自動朗讀家教回覆**. If `voiceSource === "browser"` and `!canSpeak()`: **此瀏覽器不支援語音合成，回覆只會以文字顯示。**
  - **外觀** — segmented **淺色** / **深色** / **跟隨系統** (`THEMES`); `storeTheme` + `applyTheme` as today; DevTools overlay theme patch stays when `IS_DEV`.
  - Operator links (same labels, in-page, not a drawer): **需求執行** → `/runs`, **用量統計** → `/usage`, **API 呼叫紀錄** → `/logs`, **音色目錄** → `/voices`, **ElevenLabs TTS 測試** → `/tts`.
  - `IS_DEV` only: **Next.js 開發者工具** (`dev only` chip), 指示器位置 / 指示器大小, **隱藏指示器 24 小時** / **已隱藏（重新整理生效）**, and the existing muted note about `npm run dev` memory. Load DevTools config on page mount when `IS_DEV` (today it loaded when the popover opened).
  - DESIGN recipes: segmented control, clay for primary save, tokens for text/borders. Prefer stacked sections on the reading width rather than a 320px popover.

- [ ] **AC5 (theme still works without the header popover):** Keep the existing inline theme script in [`app/layout.tsx`](../../app/layout.tsx) (first paint, no flash; mirrors `applyTheme`). Because `SettingsMenu` will no longer mount on every page (and `/chat/[id]` does **not** use `SiteHeader`), a **tiny dedicated client boot** must remain mounted from the **root layout** (not only `SiteHeader`) with the same `useLayoutEffect(() => { applyTheme(readStoredTheme()); }, [])` Strict Mode re-apply. No visible UI. Picking a theme on `/backend` still persists via `fluently-theme` and still applies `data-theme` on `<html>`. **沒有 `data-theme` = 跟隨系統** remains true. Do not lose theme persistence on home, scenarios, chat, or operator pages.

- [ ] **AC6 (remove conversation back chevron only):** In [`app/chat/[id]/page.tsx`](../../app/chat/[id]/page.tsx) header, remove the `Link` `href="/scenarios"` whose visible text is `←`. Mode picker, script, and live share this header — all three must have **no** back chevron. Remaining header: tinted emoji + title block (and no 設定). Do **not** leave a dead spacer that looks like a missing control.
  - **Do not remove:** chat-room **再練一次**, logs pagination **← 上一頁**, `/scenarios` **← 回首頁**, `/usage` **← 回首頁**, `/runs` **← 回首頁**, `/logs` **← 用量統計**, `/tts` **← API 呼叫紀錄**, `/voices` **← ElevenLabs TTS 測試**, or `/runs/[id]` **← 需求執行**.

- [ ] **AC7 (DATA.md + two no-key 401 strings; no schema/logic work):** No new D1 tables, no new migrations, no catalog API rewrite, no new `app/api/**` routes. Voice source / API key / auto-speak stay client `localStorage` ([`lib/settings.ts`](../../lib/settings.ts)). Backend **same commit**:
  - [`docs/DATA.md`](../DATA.md): add `/backend` to the §1 gated-pages sentence (`/scenarios` `/chat` `/usage` `/logs` `/tts` `/voices` `/runs` **`/backend`**). In §4, replace every Gemini-key / 家教的聲音 **設定面板** citation with 後台 `/backend` (flow diagram 「設定面板寫進 localStorage」, 「設定面板的 key 仍可驗證」, and §5 「設定面板的「家教的聲音」有三個選項」). In §3.5, if the settings UI file is renamed or the `/backend` panel is the importer of `VOICES` / `DEFAULT_MODEL`, update that import-path sentence so it no longer claims `components/settings-menu.tsx` if that file is gone. Do **not** put key **values** in DATA.md.
  - [`app/api/chat/route.ts`](../../app/api/chat/route.ts) and [`app/api/review/route.ts`](../../app/api/review/route.ts): change **only** the no-key **401** body string. Same status, same `resolveGeminiApiKey` behaviour. Exact new string: **還沒有 API key。到後台貼上你的 Gemini API key。** Do **not** rewrite chat/review logic, session handling, or judge/review flow. Do **not** change `POST /api/key-check`, speak, or key resolution. `/api/speak` already says **還沒有 API key** (no 右上角) — leave it.
  Do **not** edit [`docs/SCENARIOS.md`](../SCENARIOS.md). Do **not** change public scenario `id`s. Do **not** edit historical specs that quote the old 401 sentence.

- [ ] **AC8 (no-key wells: in-page 後台 link):** After the gear is gone, chat has no `UserMenu` (AC2 non-goal). Script and live no-key wells must not say 「點右上角」 or treat **設定** as the instruction. Both wells keep the existing clay-wash card. **後台** is a `Link` `href="/backend"` the learner can tap without the gear.
  - Script ([`components/chat-room.tsx`](../../components/chat-room.tsx), exact): **還沒設定 Gemini API key。到後台貼上你的 key 就可以開始對話。** Keep the existing **去申請一組** link → `https://aistudio.google.com/apikey`.
  - Live ([`components/live-room.tsx`](../../components/live-room.tsx), exact): **還沒設定 Gemini API key。到後台貼上你的 key 就可以開始。**
  Grep those two files after the change: zero 「點右上角」 / 「右上角設定」. Frontend owns both files.

## Frontend / backend fields

| Field | Source | Type | Notes |
|---|---|---|---|
| Gemini API key | UI `/backend` / `localStorage` `fluently-gemini-key` | `string` | Sent as `x-gemini-key` on `POST /api/key-check` and chat. **Never D1 / logs / this spec’s values.** Empty allowed (server key fallback). |
| `voiceSource` | UI segmented / `localStorage` `fluently-voice-source` | `"elevenlabs" \| "gemini" \| "browser"` | Default elevenlabs. `lib/settings.ts`. |
| `voiceName` | UI Gemini `<select>` / `localStorage` `fluently-voice-name` | `string` | Gemini `VOICES` id only. Unused when source is elevenlabs or browser. |
| `autoSpeak` | UI toggle / `localStorage` `fluently-auto-speak` | `boolean` | Stored `"on"` / `"off"`; default on. |
| `theme` | UI segmented / `localStorage` `fluently-theme` | `"light" \| "dark" \| "system"` | `lib/theme.ts`. Inline script + root layout boot apply it. |
| DevTools corner / scale / hide | `/backend` when `IS_DEV` / existing `lib/devtools.ts` | existing | Unchanged endpoints. Prod `/backend` omits this block. |
| Session cookie | proxy + `getCurrentUser()` | cookie | Gate `/backend` like `/tts`. No new auth table. |
| `ELEVENLABS_API_KEY` | env / Worker secret only | — | **Not** a field on `/backend`. Page never collects it. |

No new D1 columns. No new JSON API contract.

### File ownership (avoid same-file edits)

| Owner | Paths |
|---|---|
| Frontend | `app/backend/**`, settings panel (or refactor of `components/settings-menu.tsx`), theme boot in root layout, `components/site-header.tsx`, `components/user-menu.tsx`, `app/chat/[id]/page.tsx` (remove `←` and `SettingsMenu`), `components/chat-room.tsx` and `components/live-room.tsx` (AC8 no-key copy + **後台** link), `proxy.ts` matcher, `docs/DESIGN.md` §2 and §7 |
| Backend | `docs/DATA.md` (gated `/backend` + replace leftover **設定面板** in §3.5 / §4 / §5 家教的聲音). Plus **only** the no-key **401** string in `app/api/chat/route.ts` and `app/api/review/route.ts` (AC7). Do **not** rewrite catalog APIs, `lib/db.ts`, chat/review logic, or other `app/api/**`. |

If both roles would need the same file, **stop** and write it in Next Step — do not dual-edit.

## Errors

| Case | User-visible | API / log |
|---|---|---|
| No session on `GET /backend` | Redirect `/login?redirect=/backend` | proxy matcher; no API body |
| Cookie present but invalid | Redirect `/login` (same as `/tts` page loader) | `getCurrentUser()`; no D1 write for settings |
| Signed-out UserMenu | **登入** only; no 後台 | no request to `/backend` until they sign in |
| Empty Gemini key save (user cleared field after hydrate) | **已清除** | no `/api/key-check` needed; must **not** fire on blank first paint |
| Key verify success | **已驗證，可以開始對話** | existing `POST /api/key-check`; key not logged |
| Key verify failure | API `message` or **驗證失敗** | existing route; `ok` false; no secret in logs |
| Key verify network error | **無法連線到伺服器** | client catch; no new log |
| Browser TTS unavailable | **此瀏覽器不支援語音合成，回覆只會以文字顯示。** | none |
| No Gemini key on `POST /api/chat` or `POST /api/review` | **還沒有 API key。到後台貼上你的 Gemini API key。** | **401**; same `resolveGeminiApiKey`; no logic change. `/api/speak` stays **還沒有 API key** |
| No-key well, script | **還沒設定 Gemini API key。到後台貼上你的 key 就可以開始對話。** (**後台** → `/backend`; keep **去申請一組**) | none |
| No-key well, live | **還沒設定 Gemini API key。到後台貼上你的 key 就可以開始。** (**後台** → `/backend`) | none |
| `ELEVENLABS_API_KEY` missing | **Not shown on `/backend`** | unchanged `/tts` / `/api/elevenlabs` behaviour |

## Non-goals

- A ninth scenario, any public scenario `id` change, or edits to [`docs/SCENARIOS.md`](../SCENARIOS.md).
- New D1 tables, migrations, catalog REST, or collecting `ELEVENLABS_API_KEY` on `/backend`.
- Admin role separate from “any signed-in user” (same as `/tts` / `/voices` today).
- Adding `UserMenu` or a Wordmark back-link to the conversation header. No-key learners reach `/backend` via AC8’s in-page **後台** link.
- Removing 再練一次, logs **← 上一頁**, or other pages’ **← 回首頁** / operator back links.
- Changing `POST /api/key-check`, Gemini / ElevenLabs speak paths, `lib/settings.ts` storage keys (reuse them), or `/api/speak` copy.
- Rewriting chat/review logic; backend may change **only** the two no-key 401 strings in AC7.
- Putting keys in D1 or `api_logs`.
- Dark-mode `dark:` classes or new colour tokens.
- Editing historical specs (`post-chat-review`, `closing-intent`, `scenario-end-intent`) that quote the old 401 sentence.

## Handoff

- Goal: Move header settings onto a gated `/backend` page, reach it from UserMenu 後台, drop the chat `←`, and keep theme persistence without the gear popover.
- Changes: `docs/specs/backend-settings-page.md` (QA Must-fix 1–4)
- Next Step: QA spec review `review_pass: 2` (`qa` subagent)
