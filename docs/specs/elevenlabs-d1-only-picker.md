# Spec: ElevenLabs D1-only picker

- Slug: `elevenlabs-d1-only-picker`
- Status: draft
- Source request: 程式碼內 吃環境變數的可以拿掉，現在要改成都吃Ｄ1 本地和線上都一樣

## Background

Operators want **one** ElevenLabs voice/model pick path for `next dev` and production. Both already share the same product code against their D1 binding (local miniflare vs remote Worker instance, same schema — [`docs/DATA.md`](../DATA.md) §1). This spec removes leftover env **pickers**, not the API key.

Already true (cite; **do not regress**):

- Voice catalog `/voices` and tables `elevenlabs_voices` / `characters` are shipped ([`docs/specs/voice-catalog.md`](./voice-catalog.md), [`docs/specs/local-d1-elevenlabs-voice.md`](./local-d1-elevenlabs-voice.md)).
- `POST /api/elevenlabs` already resolves voice from D1: valid session → `resolveSessionVoiceId()` (session → scenario → character → voice platform `voice_id`); else `defaultVoiceId()` (`ORDER BY is_free DESC, id ASC`). Empty catalog → **400** `{ "error": "還沒有音色。請到音色目錄新增一顆。" }`.
- Grep `app/`, `lib/`, `components/`, `proxy.ts` for `ELEVENLABS_VOICE_ID`: **zero** matches. An operator’s local env may still define that unused name; product code must never start reading it.
- `/tts` and settings already say the voice comes from the catalog / D1 (`音色從資料庫讀，請到音色目錄管理。` / `角色音色走 ElevenLabs，由音色目錄指定。…`). Tester field **預設音色（資料庫，偏好免費）**. Do not put the voice back into env copy.
- `ELEVENLABS_API_KEY` stays env-only (`.env.local` / `.dev.vars` / `wrangler secret`). **Never** store keys in D1, this spec, logs, or commits. Do **not** quote secret values. Do **not** write or commit `.env.local` / `.dev.vars`.
- [`app/tts/page.tsx`](../../app/tts/page.tsx) may keep `process.env.ELEVENLABS_API_KEY` **only** to know whether a key is configured (`configured` prop). That is the key, not a voice or model picker.
- All **8** public scenarios ([`docs/SCENARIOS.md`](../SCENARIOS.md)) still point at character `bella`. Do **not** add a ninth scenario. Do **not** change public scenario `id`s.

Leftover in-scope (new work): [`app/api/elevenlabs/route.ts`](../../app/api/elevenlabs/route.ts) still falls back to `process.env.ELEVENLABS_MODEL` when `body.model` is not in `ELEVENLABS_MODELS`. Local and production can therefore pick different models if that env name is set in one place and not the other. That fallback **must go**.

Model pick after this spec: known `body.model` (id in `ELEVENLABS_MODELS`) **or** the code constant `DEFAULT_ELEVENLABS_MODEL` (`eleven_flash_v2_5` in [`lib/elevenlabs.ts`](../../lib/elevenlabs.ts)). **Do not** add a D1 model column. **Do not** move the API key into D1.

This spec’s **new product work is backend-only** (the route + `DATA.md`). Frontend copy already does not claim env picks a voice; frontend is a **must-not-regress lock**.

## User stories

1. As an operator, I want practice chat TTS (`next dev` and production) to use the same D1 catalog voice join, so `/voices` is the only voice picker in both environments.
2. As an operator, I want `/tts` (no `scenarioId`) to use `defaultVoiceId()` from that same D1, never an env voice name.
3. As an operator, I want the ElevenLabs **model** to be the request body’s known id or `DEFAULT_ELEVENLABS_MODEL`, so local and production do not diverge via `ELEVENLABS_MODEL`.
4. As a learner or operator, I still get **401** `請先登入` when unauthenticated, and the existing env key error when `ELEVENLABS_API_KEY` is missing — never a key from D1.

## Acceptance criteria

- [ ] **AC1 (already true — lock: voice from D1, same code path):** Logged-in `POST /api/elevenlabs` with a known public `scenarioId` (e.g. `cafe`) and `text` succeeds (key present, catalog non-empty). Success header **`x-voice`** is that scenario’s character’s assigned **`elevenlabs_voices.voice_id`** (ElevenLabs **platform** id), not the internal catalog `id` (seed PK `bella`). Same for `mode: "script"` and `mode: "live"`. Resolution is `createSession` / existing `sessionId` → `resolveSessionVoiceId()` only. Body must **not** accept `voice`, `voiceId`, or `ELEVENLABS_VOICE_ID` as a picker; extra keys are ignored. Client `speakReply()` already omits a voice field for this route; do not add one. Do not document a platform id value.
  - Without `scenarioId` / without a resolvable session (`/tts` tester): `defaultVoiceId()` at **request** time. Success `x-voice` equals `SELECT voice_id FROM elevenlabs_voices ORDER BY is_free DESC, id ASC LIMIT 1` (trim; empty → treat as missing). Do **not** change that ordering.
  - After `PATCH /api/voices/:id` with a new `voiceId`, the next matching POST `x-voice` equals the current D1 platform `voice_id`. After `PATCH /api/characters/:id` with a new `elevenlabsVoiceId`, the next practice POST for a scenario that uses that character has `x-voice` equal to the newly assigned row’s platform `voice_id`.
  - Do **not** branch local vs production for voice (no `NODE_ENV` / env-name voice picker). `next dev` and the Worker use the same route against their D1 binding.
  - Do **not** rewrite [`lib/db.ts`](../../lib/db.ts) helpers or catalog REST for this spec.

- [ ] **AC2 (new work — drop `ELEVENLABS_MODEL` env fallback):** In [`app/api/elevenlabs/route.ts`](../../app/api/elevenlabs/route.ts) **only**, stop reading `process.env.ELEVENLABS_MODEL`. Model selection:
  1. If `body.model` is a string whose id is in `ELEVENLABS_MODELS` → use that id.
  2. Else (omitted, blank, or unknown) → `DEFAULT_ELEVENLABS_MODEL` (`eleven_flash_v2_5`).
  - Success response header **`x-model`** equals the model actually sent to ElevenLabs (observable). Practice `speakReply()` does not send `model`; those POSTs must have `x-model` = `DEFAULT_ELEVENLABS_MODEL`. `/tts` tester still sends a known id from the `ELEVENLABS_MODELS` select; that POST’s `x-model` equals the selected id.
  - Unknown `body.model` is **not** a 400; it is the default (same as omitted). Do not invent a new error string.
  - Do **not** add a model column on `elevenlabs_voices`, `characters`, `scenarios`, or any other table. Do **not** add a migration. Prefer the existing constant + body.
  - Do **not** change `ELEVENLABS_MODELS` membership or the `DEFAULT_ELEVENLABS_MODEL` string in [`lib/elevenlabs.ts`](../../lib/elevenlabs.ts) (shared with the tester). The client helper still receives `model` as an argument and must not read env.

- [ ] **AC3 (grep lock — leftover ElevenLabs pickers gone):** After the change:
  - `ELEVENLABS_VOICE_ID` in `app/`, `lib/`, `components/`, `proxy.ts`: **zero** matches.
  - `process.env.ELEVENLABS_MODEL` (or any other `process.env` read of that name) in those same trees: **zero** matches.
  - Remaining ElevenLabs `process.env` in product code is **only** `ELEVENLABS_API_KEY` (route for the secret; `/tts` page boolean `configured`). [`lib/elevenlabs.ts`](../../lib/elevenlabs.ts) still does not read env.
  - Do not write or commit `.env.local` / `.dev.vars`. Do not quote env **values** or a platform voice id. Unused operator env names are silent (no UI that says “env voice/model ignored”).

- [ ] **AC4 (already true — lock: auth, empty input, key stays env):** Unauthenticated `POST /api/elevenlabs` → **401** `{ "error": "請先登入" }`; no D1 write; no provider call. Missing / blank `ELEVENLABS_API_KEY` after a valid session → existing **401** `{ "error": "還沒有 ElevenLabs API key。在 .env.local 設 ELEVENLABS_API_KEY。" }` (env-only; not from D1; do not invent a new string). Empty `elevenlabs_voices` → **400** `{ "error": "還沒有音色。請到音色目錄新增一顆。" }`. Empty `text` → **400** `{ "error": "沒有要唸的內容" }`. Invalid JSON → **400** `{ "error": "請求格式錯誤" }`. Key never in JSON, D1, `api_calls`, or `api_logs`. Failed synthesize still writes `api_calls` `kind='tts'` `ok=0` when a practice session exists (unchanged).

- [ ] **AC5 (DATA.md, same backend commit):** Update [`docs/DATA.md`](../DATA.md) in the **same** backend commit as AC2: local and production TTS voice pick is D1 only (`resolveSessionVoiceId` / `defaultVoiceId`); env name `ELEVENLABS_VOICE_ID` is never a picker; env name `ELEVENLABS_MODEL` is never a picker; model is known `body.model` or `DEFAULT_ELEVENLABS_MODEL`; `ELEVENLABS_API_KEY` still env-only. Names only — no secret **values**, no `.env.local` / `.dev.vars` **contents**. Do **not** edit [`docs/SCENARIOS.md`](../SCENARIOS.md). Do **not** add a ninth scenario. Do **not** change public scenario `id`s (`cafe`, `directions`, `small-talk`, `hotel`, `clinic`, `phone-interview`, `interview`, `debate`).

- [ ] **AC6 (already true — frontend lock, no new copy):** Do **not** change `/tts`, tester, or settings copy unless it still claims env picks a **voice** or **model** (today it does not). Keep:
  - `/tts` intro sentence **音色從資料庫讀，請到音色目錄管理。** (key may still be described as living in `.env.local`; that is the key.)
  - Tester empty-voice well **還沒有可用的音色。請到音色目錄新增一顆。** + link **音色目錄** → `/voices`. Label **預設音色（資料庫，偏好免費）**. Empty value **尚未設定**.
  - Settings ElevenLabs blurb **角色音色走 ElevenLabs，由音色目錄指定。同一句重播不會再合成，失敗時退回瀏覽器語音。**
  - `/tts` `configured` from `ELEVENLABS_API_KEY` presence only. Tester model `<select>` stays `ELEVENLABS_MODELS` (client constant), not env. Frontend must not read `ELEVENLABS_VOICE_ID` or `ELEVENLABS_MODEL`. Do not collect a key on `/tts` or `/voices`. No DESIGN token changes; do not edit [`docs/DESIGN.md`](../DESIGN.md) unless copy actually changes (it should not).

## Frontend / backend fields

| Field | Source | Type | Notes |
|---|---|---|---|
| `elevenlabs_voices.voice_id` | D1 | `string` | ElevenLabs **platform** id. Success `x-voice`. Not a secret. Not the internal `id`. |
| `elevenlabs_voices.id` | D1 PK | `string` | Internal kebab (seed `bella`). FK target. |
| `elevenlabs_voices.is_free` | D1 `0`\|`1` | integer | `defaultVoiceId()` prefers `1`, then `id ASC`. Unchanged. |
| `characters.elevenlabs_voice_id` | D1 FK | `string` | → `elevenlabs_voices.id`. Practice path uses this join. |
| `scenarios.character_id` | D1 FK | `string` | Unchanged. Public scenario `id`s unchanged. |
| `scenarioId` | POST body | `string` | Practice script/live. Known id → session + `resolveSessionVoiceId()`. |
| `sessionId` | POST body / `x-session-id` | `string` \| omitted | Reused when it exists for `user.id`; else created when `scenarioId` is valid. |
| `mode` | POST body | `"script"` \| `"live"` | Session mode only; does not pick voice or model. |
| `text` | POST body | `string` | Required after trim. |
| `model` | POST body | `string` \| omitted | Picker **only** if id ∈ `ELEVENLABS_MODELS`; else `DEFAULT_ELEVENLABS_MODEL`. Not from env. Not from D1. |
| `x-voice` | Response header | platform `voice_id` | Observable voice picker result. |
| `x-model` | Response header | model id | Observable model picker result. |
| `ELEVENLABS_API_KEY` | env / Worker secret | string | **Only** ElevenLabs secret. Route synthesizes with it; `/tts` may boolean-check presence. Never D1 / logs / this spec’s values. |
| `ELEVENLABS_VOICE_ID` | unused env **name** | — | Must not be read. Do not document a value. |
| `ELEVENLABS_MODEL` | unused env **name** | — | Must not be read after AC2. Do not document a value. |

### File ownership (avoid same-file edits)

| Owner | Paths |
|---|---|
| Backend | [`app/api/elevenlabs/route.ts`](../../app/api/elevenlabs/route.ts) (AC2 model fallback), [`docs/DATA.md`](../DATA.md) (AC5) |
| Frontend | **None** unless AC6 copy is still wrong (it is not). Do not edit `/tts`, tester, settings, `speakReply`, Gemini `VOICES`, `proxy.ts`, or [`lib/elevenlabs.ts`](../../lib/elevenlabs.ts). Do not regress voice-catalog copy. Do not edit `lib/db.ts`. |

If both roles would need the same file, **stop** and write it in Next Step — do not dual-edit. [`lib/elevenlabs.ts`](../../lib/elevenlabs.ts) is shared; this spec must **not** change it.

## Errors

| Case | User-visible | API / log |
|---|---|---|
| No session | `{ "error": "請先登入" }` | **401**; no D1 write; no provider call |
| Missing / blank `ELEVENLABS_API_KEY` | `{ "error": "還沒有 ElevenLabs API key。在 .env.local 設 ELEVENLABS_API_KEY。" }` | **401**; key never logged; not from D1 |
| Invalid JSON | `{ "error": "請求格式錯誤" }` | **400** |
| Empty `text` | `{ "error": "沒有要唸的內容" }` | **400** |
| Empty catalog (no resolvable platform id) | `{ "error": "還沒有音色。請到音色目錄新增一顆。" }` | **400** |
| Unknown / omitted `body.model` | (success path; `x-model` = `DEFAULT_ELEVENLABS_MODEL`) | not an error |
| Voice Library / 402 (unchanged) | existing ElevenLabs copy | existing status; no key in body |

Do not add a user-visible error for “env voice/model ignored”. Unused `ELEVENLABS_VOICE_ID` / `ELEVENLABS_MODEL` are silent.

## Non-goals

- New `/voices` UI, catalog REST, seed/migration changes, or a D1 model column.
- Changing `defaultVoiceId()` ordering, empty-catalog copy, or `resolveSessionVoiceId()`.
- Gemini env pickers (`GEMINI_MODEL`, `GEMINI_TTS_MODEL`, `GEMINI_API_KEY`) or `/api/speak`.
- Storing `ELEVENLABS_API_KEY` (or any secret) in D1, specs, or logs; quoting env **values**; committing `.env.local` / `.dev.vars`.
- A ninth scenario, renaming public scenario `id`s, creating/deleting characters, per-user voices.
- Editing [`docs/SCENARIOS.md`](../SCENARIOS.md) or [`docs/DESIGN.md`](../DESIGN.md) (no UI/token change).
- Invalidating the in-memory `speakReply` clip cache after a catalog PATCH.
- Calling ElevenLabs to validate `voice_id` (a bad platform id still fails at synthesize, as today).
- Asking the operator to delete unused env names from their local files (human-only; do not write those files).

## Handoff

- Goal: Local and production pick ElevenLabs **voice** from D1 the same way; **model** from known request body or `DEFAULT_ELEVENLABS_MODEL` only. Drop `ELEVENLABS_MODEL` env fallback. Keep the API key in env. No model column.
- Changes: `docs/specs/elevenlabs-d1-only-picker.md` (this file). `docs/SCENARIOS.md` unchanged.
- Next Step: QA spec review (`qa` subagent)
