# Spec QA: backend-settings-page

- Slug: `backend-settings-page`
- review_pass: **2** (diff review, frontend only)
- Result: **PASS**
- Spec: [`docs/specs/backend-settings-page.md`](./backend-settings-page.md) AC1–AC8
- Scope: Confirm pass-1 Must-fix 1 (exact `/backend` lead). Backend already PASS on pass 1. No product code in this review.

Must-fix: **none**. Should-fix does not start another produce.

---

## Must-fix: none

| Pass-1 Must-fix | Owner | Result |
|---|---|---|
| 1. AC1 exact lead | frontend | PASS — visible `<p>` in [`app/backend/page.tsx`](../../app/backend/page.tsx) is **調整 Gemini key、家教聲音與外觀，並連到用量、紀錄、音色目錄與 TTS。這些偏好只存在這個瀏覽器，不會寫進資料庫。** |

---

## Should-fix (do not produce, do not STOP)

1. **frontend** — Signed-out home / login still have no theme picker (`/backend` is gated). User story 5 only requires applying a saved theme. Acceptable.
2. **frontend** — Mid-chat *with* a key still has no standing nav to `/backend`. No-key path is AC8. Do not add UserMenu to chat.
3. Historical specs still quote the old 401 sentence. Non-goal: do not edit them.

---

## Checked (AC1–AC8)

| AC | Result | Notes |
|---|---|---|
| AC1 auth + `/backend` page | PASS | Matcher `/backend` + `/backend/:path*` in `proxy.ts`. `getCurrentUser()` + `redirect("/login")`. Compact `SiteHeader`, title **後台 — Fluently**, h1 classes match `/tts`, exact lead, `max-w-3xl` `px-5 sm:px-8` `.rise`, tokens, no hex/`dark:`. DESIGN §2 + §7 list `theme-boot` + `/backend` + `settings-panel`. |
| AC2 gear gone | PASS | Zero `SettingsMenu` / `aria-label="設定"` in `SiteHeader` and `app/chat/[id]/page.tsx`. No UserMenu on chat. |
| AC3 UserMenu **後台** | PASS | After 需求執行, before 登出. Signed-out **登入** only. |
| AC4 page content + hydrate | PASS | Page, not popover. Mount hydrate. Empty 儲存 does not wipe unread key. |
| AC5 theme boot | PASS | Layout inline script + root-layout `theme-boot` re-apply. |
| AC6 remove chat `←` only | PASS | Chat chevron gone. **再練一次** and labeled `←` kept. |
| AC7 DATA.md + two 401s | PASS | Backend (pass 1). Do not re-produce. |
| AC8 no-key wells | PASS | Exact script/live copy + **後台** → `/backend`. |
| Secrets | PASS | Key never D1/logs; page never collects `ELEVENLABS_API_KEY`. |

---

## Runnable checklist (implementation review)

Do **not** add a test framework. Do **not** commit `.env.local` / `.dev.vars`. Do **not** put key values in specs or DATA.md.

```bash
npm run build && npm run lint
```

Unauthenticated:

```bash
# 307 /login?redirect=/backend
curl -sI http://localhost:3000/backend | grep -i location
```

Logged-in, browser:

- [ ] `/backend` compact header, **no** gear; `h1` **後台**; **exact** lead; settings content is a page (not `.pop`).
- [ ] Prefs hydrate on first paint (stored Gemini key / voice / theme visible; empty 儲存 does not wipe unread key).
- [ ] UserMenu signed-in: **後台** after 需求執行, before 登出; signed-out: **登入** only.
- [ ] Grep: zero `SettingsMenu` / `aria-label="設定"` in `SiteHeader` and `app/chat/[id]/page.tsx`.
- [ ] Chat header: no `←`, no gear, no dead spacer. Mode picker / script / live all three.
- [ ] **再練一次** and every labeled `←` in AC6 still present.
- [ ] Script + live no-key wells: AC8 copy; **後台** → `/backend`; grep those files for zero 「點右上角」.
- [ ] `POST /api/chat` and `POST /api/review` with no key: **還沒有 API key。到後台貼上你的 Gemini API key。** (`/api/speak` unchanged).
- [ ] Theme: first paint + Strict Mode remount on home, scenarios, chat, `/backend` still apply `fluently-theme`. Pick 深色 on `/backend`, visit `/` — still dark.
- [ ] `docs/DESIGN.md` §2 + §7 and `docs/DATA.md` §1 + §3.5/§4/§5 設定面板 wording updated. `docs/SCENARIOS.md` untouched.

---

## Handoff

- Goal: Diff review pass 2 of gated `/backend` settings page (frontend Must-fix 1).
- Changes: `docs/specs/backend-settings-page-qa.md` (Must-fix cleared)
- Next Step: **review_pass: 2 · PASS** — frontend and backend complete. No further produce.
