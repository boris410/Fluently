# Diff QA: elevenlabs-d1-only-picker

- Slug: `elevenlabs-d1-only-picker`
- review_pass: **1** (diff review)
- Result: **PASS**
- Spec: [`docs/specs/elevenlabs-d1-only-picker.md`](./elevenlabs-d1-only-picker.md)
- Scope: `git diff` / `git status` vs AC2 (new work) + AC5 (`DATA.md`) and AC1 / AC3 / AC4 / AC6 already-true locks. Frontend is **None**. No product code in this review.
- Spec review: already **PASS** (prior). This file is the implementation checklist.

Must-fix: **none** (backend). Frontend: **None**.

---

## Must-fix: none

| Check | Owner | Result |
|---|---|---|
| AC2: no `process.env.ELEVENLABS_MODEL`; known `body.model` else `DEFAULT_ELEVENLABS_MODEL`; `x-model`; unknown model not 400 | backend | PASS — `app/api/elevenlabs/route.ts` is `knownModel ? body.model! : DEFAULT_ELEVENLABS_MODEL`. Success header `x-model` is that same `model`. Omitted / blank / unknown fall through to the constant; no new 400. |
| AC3 grep lock | backend | PASS — `ELEVENLABS_VOICE_ID` has **zero** matches in `app/`, `lib/`, `components/`, `proxy.ts`. `process.env.ELEVENLABS_MODEL` has **zero** matches. Remaining ElevenLabs `process.env` is only `ELEVENLABS_API_KEY` (route secret + `/tts` `configured`). `lib/elevenlabs.ts` still does not read env. |
| AC5 `DATA.md`: D1 voice both envs; names only, no secrets | backend | PASS — §4: local + production pick from the bound D1 (`resolveSessionVoiceId` / `defaultVoiceId`); env names `ELEVENLABS_VOICE_ID` and `ELEVENLABS_MODEL` are not pickers; model is known `body.model` or `DEFAULT_ELEVENLABS_MODEL`; `ELEVENLABS_API_KEY` still env-only. Names only — no secret values, no `.env.local` / `.dev.vars` contents, no platform id string. |
| Do not rewrite `lib/db.ts` or `lib/elevenlabs.ts` | backend | PASS — `lib/elevenlabs.ts` has **no** diff (`DEFAULT_ELEVENLABS_MODEL` / `ELEVENLABS_MODELS` unchanged). This spec did not rewrite `lib/db.ts` helpers: `resolveSessionVoiceId()` / `defaultVoiceId()` SQL still `is_free DESC, id ASC`. Working-tree `lib/db.ts` diff is the already-shipped voice-catalog produce, not an AC2 rewrite. No new migration / model column. `docs/SCENARIOS.md` untouched. |
| AC1 / AC4 locks (voice path, errors, key) | backend | PASS — body type has no `voice` / `voiceId` picker; `x-voice` still D1 platform `voice_id`. Unauth **401** `請先登入`; missing key **401** existing env string; empty text / bad JSON / empty catalog **400** existing strings. Key never in JSON / D1 / logs. |
| No secrets in diff | backend | PASS — names only. |

---

## Should-fix (do not produce, do not STOP)

1. The working tree still has voice-catalog / local-d1 files (`/voices`, catalog routes, `/tts` copy, `DESIGN.md`, `0002` `DO NOTHING`). Out of this spec. Do not revert `lib/db.ts` to “satisfy” the lock — that would undo voice-catalog.
2. `DATA.md` also documents catalog REST / helpers (voice-catalog). Harmless; not an AC5 hole.

---

## Runnable checklist

Do **not** add a test framework. Do **not** quote a platform id or env **value**. Do **not** commit `.env.local` / `.dev.vars`.

### Build

```bash
npm run build && npm run lint
```

### AC3 grep (must stay zero / key-only)

```bash
rg -n 'ELEVENLABS_VOICE_ID' app lib components proxy.ts
rg -n 'process\.env\.ELEVENLABS_MODEL|process\.env\[['\''"]ELEVENLABS_MODEL' app lib components proxy.ts
rg -n 'process\.env' app lib components proxy.ts | rg -i 'eleven'
```

Expect: first two commands print nothing. Third shows only `process.env.ELEVENLABS_API_KEY` in `app/api/elevenlabs/route.ts` and `app/tts/page.tsx`.

### AC2 model pick (`x-model`; unknown is not 400)

Need a logged-in cookie and a non-empty catalog. Do **not** put a key value in the shell history.

```bash
# Practice path (speakReply sends no model) → x-model must be DEFAULT_ELEVENLABS_MODEL
curl -sD - -o /dev/null -X POST http://localhost:3000/api/elevenlabs \
  -H 'content-type: application/json' \
  --cookie "$COOKIE" \
  -d '{"text":"Hello from QA.","scenarioId":"cafe","mode":"script"}'

# Known tester id → x-model equals that id
curl -sD - -o /dev/null -X POST http://localhost:3000/api/elevenlabs \
  -H 'content-type: application/json' \
  --cookie "$COOKIE" \
  -d '{"text":"Hello from QA.","model":"eleven_multilingual_v2"}'

# Unknown / blank model → still 2xx; x-model = eleven_flash_v2_5 (not 400)
curl -sD - -o /dev/null -X POST http://localhost:3000/api/elevenlabs \
  -H 'content-type: application/json' \
  --cookie "$COOKIE" \
  -d '{"text":"Hello from QA.","model":"not-a-real-model"}'
curl -sD - -o /dev/null -X POST http://localhost:3000/api/elevenlabs \
  -H 'content-type: application/json' \
  --cookie "$COOKIE" \
  -d '{"text":"Hello from QA.","model":""}'
```

Expect: first and last two have `x-model: eleven_flash_v2_5`. Known-id POST has `x-model: eleven_multilingual_v2`. None of the unknown/blank POSTs are 400 for the model.

### AC1 / AC4 locks

- [ ] Unauthenticated `POST /api/elevenlabs` → **401** `{ "error": "請先登入" }`.
- [ ] Logged-in, missing/blank `ELEVENLABS_API_KEY` → **401** `{ "error": "還沒有 ElevenLabs API key。在 .env.local 設 ELEVENLABS_API_KEY。" }`.
- [ ] Empty `text` → **400** `{ "error": "沒有要唸的內容" }`. Invalid JSON → **400** `{ "error": "請求格式錯誤" }`.
- [ ] Empty catalog → **400** `{ "error": "還沒有音色。請到音色目錄新增一顆。" }`.
- [ ] Logged-in POST with `scenarioId: "cafe"` success header `x-voice` equals that character’s current D1 **platform** `voice_id` (not internal `bella`). Extra body keys `voice` / `voiceId` / `ELEVENLABS_VOICE_ID` ignored.
- [ ] `/tts` tester POST (no `scenarioId`) `x-voice` equals `defaultVoiceId()` (`ORDER BY is_free DESC, id ASC`).
- [ ] Key never in JSON, D1, `api_calls`, or `api_logs`.

### AC6 frontend lock (no produce)

- [ ] `/tts` intro still **音色從資料庫讀，請到音色目錄管理。**
- [ ] Tester empty well **還沒有可用的音色。請到音色目錄新增一顆。** + **音色目錄** → `/voices`. Label **預設音色（資料庫，偏好免費）**. Empty value **尚未設定**.
- [ ] Settings blurb **角色音色走 ElevenLabs，由音色目錄指定。同一句重播不會再合成，失敗時退回瀏覽器語音。**
- [ ] Frontend does not read `ELEVENLABS_VOICE_ID` or `ELEVENLABS_MODEL`.

---

## Handoff

- Goal: Diff-review AC2 (drop `ELEVENLABS_MODEL` env fallback) + AC5 (`DATA.md`) and confirm AC1 / AC3 / AC4 / AC6 locks. Frontend is **None**.
- Changes: this file → **PASS**; Must-fix none. Checklist includes `npm run build && npm run lint` plus grep and `x-model` curls.
- Next Step: **review_pass: 1 · PASS** — no backend fix. Frontend is **None**. Orchestrator can close the loop.
