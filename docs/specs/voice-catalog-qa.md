# Diff QA: voice-catalog

- Slug: `voice-catalog`
- review_pass: **1** (diff review)
- Result: **PASS** (frontend **PASS** · backend **PASS**)
- Spec: [`docs/specs/voice-catalog.md`](./voice-catalog.md) AC1–AC6, API contract, Errors table
- Scope: `git status` + `git diff` (untracked included). No product code in this review.

Must-fix: **none**. Should-fix does not start another produce.

This pass live-checked unauthenticated gates against `http://localhost:3000`:
`GET /voices` → **307** `/login?redirect=%2Fvoices`; `GET /voices/x` → **307** `/login?redirect=%2Fvoices%2Fx`.
Every catalog method without a cookie → **401** `{ "error": "請先登入" }`.

---

## Must-fix: none

Checked the items called out for this pass; none fail AC.

| Check | Owner | Result |
|---|---|---|
| Auth + `/voices` route + nav + exact lead | frontend | PASS — `proxy.ts` matcher `/voices` + `/voices/:path*` (frontend-only). Page `getCurrentUser()` + `redirect("/login")`. Compact `SiteHeader`. Settings **音色目錄** immediately above **ElevenLabs TTS 測試**. `/tts` link **音色目錄**. `/voices` back **← ElevenLabs TTS 測試**. Title **音色目錄 — Fluently**. `h1` size + exact lead. |
| Unauthenticated API 401, no catalog write | backend | PASS — `requireUser()` / `getCurrentUser()` first on every `/api/voices*` and `/api/characters*` method. Live: GET/POST `/api/voices`, GET/PATCH/DELETE `/api/voices/bella`, GET `/api/characters`, PATCH `/api/characters/bella` → 401 `請先登入`. |
| Voice CRUD + camelCase JSON + empty card | frontend + backend | PASS — REST paths and `VoiceJSON` match. Create **201**, PATCH ignores extra body `id`, DELETE **204**. Empty copy **還沒有任何音色。** + create form. DESIGN tokens only; no hex / `rgb()` / `dark:`. Clay pill + 描邊 pill. `免費` static tag. `font-mono` on ids. `px-5 sm:px-8` / `max-w-3xl` / `.rise`. `docs/DESIGN.md` §7 lists `/voices` + `voice-catalog`. |
| Character re-point; no empty FK | frontend + backend | PASS — **人物** card, `name` + muted mono `id`, `<select>` `value` = voice `id`, text `{label}（{id}）`, no empty option. PATCH `{ elevenlabsVoiceId }` → 200 `CharacterJSON`. Missing/blank → **400** `人物必須指定一顆音色`. Unknown voice → **400** `找不到這顆音色`. Unknown character → **404** `找不到這個人物`. Route `getVoice` before UPDATE. |
| Delete in-use **409** + validation strings | backend | PASS — `deleteVoice` counts characters first; `in_use` → **409** `還有人物在用這顆音色，請先改指派再刪` (no SQLite FK string). Duplicate create id → **409** `這個內部代號已經存在`. Bad JSON → **400** `請求格式錯誤`. Unknown voice GET/PATCH/DELETE → **404** `找不到這顆音色`. Errors table strings match `catalog-http.ts`. |
| Stale `/tts` + settings copy; `defaultVoiceId` | frontend + backend | PASS — tester no longer mentions `ELEVENLABS_VOICE_ID` or putting a voice in `.env.local`. Empty well + label + empty value exact. `/tts` intro sentence exact. Settings blurb exact. `defaultVoiceId()` SQL unchanged (`is_free DESC, id ASC`). Empty catalog on `POST /api/elevenlabs` → **400** `還沒有音色。請到音色目錄新增一顆。`. Key stays env-only; page never collects a key. |
| Global catalog + DATA.md; no 9th scenario | backend | PASS — helpers have no `user_id`. Named exports match the spec table. `docs/DATA.md` documents `/voices`, REST, global scope, helpers, unchanged `defaultVoiceId`, no `ELEVENLABS_VOICE_ID` picker. No rewrite of `0001_init.sql` / `0002_seed.sql`. `docs/SCENARIOS.md` untouched. Public scenario ids unchanged. No catalog `api_calls` / `api_logs`. |
| Secrets not in D1 / logs / responses | backend | PASS — no key fields on catalog routes. ElevenLabs key still `process.env` only; empty-catalog 400 returns before `synthesizeElevenLabs` / `onCall`. |
| No same-file dual-edit | both | PASS — frontend owns pages / catalog / tester / settings / `proxy.ts` / `DESIGN.md`. Backend owns `app/api/voices/**`, `app/api/characters/**`, `lib/db.ts`, elevenlabs empty copy, `DATA.md`. |

---

## AC vs diff

| AC | Result | Notes |
|---|---|---|
| AC1 auth + route + nav | PASS | Matcher + page gate + 401 APIs + nav / title / h1 / lead exact. Live 307 + 401 confirmed. |
| AC2 list + CRUD + DESIGN | PASS | `ORDER BY id ASC`. Refetch after mutate. Empty dashed card (usage/runs classes) + create form. Tokens only. §7 updated. |
| AC3 characters re-point | PASS | Select + PATCH contract. No empty option. 400 / 404 split. No character create/delete. |
| AC4 referential delete + errors | PASS | App-level count before DELETE. Exact Traditional Chinese strings. |
| AC5 stale copy + `defaultVoiceId` | PASS | All required sentences exact. Picker is D1. Key env-only. |
| AC6 global + DATA.md | PASS | Shared table, helpers exported, DATA.md updated, no new scenario / migration. |

JSON camelCase wrap of D1 snake_case. Frontend `fetch`es the APIs only (does not write `lib/db.ts`).

---

## Should-fix (do not produce, do not STOP)

1. **frontend** — `refresh()` never clears `listError`. A later successful refetch after a failed first load still shows the stale well (the list itself does appear).
2. **frontend** — Catalog cards omit the DESIGN hover lift (`hover:-translate-y-0.5` / shadow). Same simplified card as the `/tts` tester.
3. **frontend** — Successful create clears the form *before* `refresh()`. If refetch throws, the new row is missing until reload and the create fields are already empty.
4. **frontend** — When the catalog is empty the character `<select>` is omitted (no empty option, which AC3 requires). Operator cannot re-point until a voice exists; seed `bella` makes this rare.
5. **backend** — Extra `GET /api/voices/:id` is not in the spec table. Harmless; `DATA.md` documents it.
6. Spec `Status` is still `draft` (leftover from spec review).

---

## Runnable checklist

```bash
npm run build && npm run lint
```

Unauthenticated (no session cookie):

```bash
# 307 /login?redirect=/voices
curl -sI http://localhost:3000/voices | grep -i location
# 307 /login?redirect=/voices/x
curl -sI http://localhost:3000/voices/x | grep -i location

# 401 {"error":"請先登入"} — no D1 write
curl -s -w '\n%{http_code}\n' http://localhost:3000/api/voices
curl -s -w '\n%{http_code}\n' -X POST http://localhost:3000/api/voices \
  -H 'content-type: application/json' -d '{"id":"demo","voiceId":"x","label":"x"}'
curl -s -w '\n%{http_code}\n' -X PATCH http://localhost:3000/api/voices/bella \
  -H 'content-type: application/json' -d '{"label":"x"}'
curl -s -w '\n%{http_code}\n' -X DELETE http://localhost:3000/api/voices/bella
curl -s -w '\n%{http_code}\n' http://localhost:3000/api/characters
curl -s -w '\n%{http_code}\n' -X PATCH http://localhost:3000/api/characters/bella \
  -H 'content-type: application/json' -d '{"elevenlabsVoiceId":"bella"}'
```

Logged-in (browser session cookie as `COOKIE`):

```bash
# 200 voices[] / characters[] — same rows for every signed-in user
curl -s -w '\n%{http_code}\n' http://localhost:3000/api/voices \
  -H "cookie: $COOKIE"
curl -s -w '\n%{http_code}\n' http://localhost:3000/api/characters \
  -H "cookie: $COOKIE"

# 400 exact strings — no row
curl -s -w '\n%{http_code}\n' -X POST http://localhost:3000/api/voices \
  -H "cookie: $COOKIE" -H 'content-type: application/json' -d '{'
curl -s -w '\n%{http_code}\n' -X POST http://localhost:3000/api/voices \
  -H "cookie: $COOKIE" -H 'content-type: application/json' \
  -d '{"id":"","voiceId":"x","label":"x"}'
curl -s -w '\n%{http_code}\n' -X POST http://localhost:3000/api/voices \
  -H "cookie: $COOKIE" -H 'content-type: application/json' \
  -d '{"id":"Bella","voiceId":"x","label":"x"}'
curl -s -w '\n%{http_code}\n' -X PATCH http://localhost:3000/api/voices/bella \
  -H "cookie: $COOKIE" -H 'content-type: application/json' -d '{}'
curl -s -w '\n%{http_code}\n' -X PATCH http://localhost:3000/api/characters/bella \
  -H "cookie: $COOKIE" -H 'content-type: application/json' \
  -d '{"elevenlabsVoiceId":"   "}'
curl -s -w '\n%{http_code}\n' -X PATCH http://localhost:3000/api/characters/bella \
  -H "cookie: $COOKIE" -H 'content-type: application/json' \
  -d '{"elevenlabsVoiceId":"missing-voice"}'

# 409 seed bella still referenced; row remains
curl -s -w '\n%{http_code}\n' -X DELETE http://localhost:3000/api/voices/bella \
  -H "cookie: $COOKIE"

# 201 create → 200 re-point bella → 204 delete unused
curl -s -w '\n%{http_code}\n' -X POST http://localhost:3000/api/voices \
  -H "cookie: $COOKIE" -H 'content-type: application/json' \
  -d '{"id":"qa-voice","voiceId":"platform-id","label":"QA","isFree":true}'
curl -s -w '\n%{http_code}\n' -X PATCH http://localhost:3000/api/characters/bella \
  -H "cookie: $COOKIE" -H 'content-type: application/json' \
  -d '{"elevenlabsVoiceId":"qa-voice"}'
curl -s -w '\n%{http_code}\n' -X DELETE http://localhost:3000/api/voices/qa-voice \
  -H "cookie: $COOKIE"
# after re-pointing bella away, DELETE bella should 204; restore seed afterwards
```

In the browser, logged in:

- [ ] Settings menu: **音色目錄** sits immediately above **ElevenLabs TTS 測試**.
- [ ] `/tts` shows link **音色目錄**, intro sentence **音色從資料庫讀，請到音色目錄管理。**, field **預設音色（資料庫，偏好免費）**, no `ELEVENLABS_VOICE_ID`.
- [ ] Settings ElevenLabs blurb is **角色音色走 ElevenLabs，由音色目錄指定。同一句重播不會再合成，失敗時退回瀏覽器語音。**
- [ ] `/voices` lead is the exact AC1 sentence. Seed `bella` lists with **免費** chip.
- [ ] Create / edit / delete a unused voice; list updates without a full navigation.
- [ ] Delete `bella` while the character still points at it: well shows **還有人物在用這顆音色，請先改指派再刪**; row stays.
- [ ] Character select has no empty option; saving a missing voice id is refused by the API.
- [ ] Page never asks for `ELEVENLABS_API_KEY`.

---

## Handoff

- Goal: Diff-review the voice catalog against every AC (auth, CRUD, FK 409, empty character voice, no secrets, DESIGN, stale env copy, DATA.md, proxy matcher, settings/tts copy).
- Changes: this file → **PASS**; Must-fix none. Frontend PASS. Backend PASS.
- Next Step: **review_pass: 1 · PASS** — no frontend/backend fix round. Feature loop for this spec is done.
