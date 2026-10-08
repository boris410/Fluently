# Spec: Local D1 ElevenLabs voice

- Slug: `local-d1-elevenlabs-voice`
- Status: draft
- Source request: 讓本地local時候吃 資料表內的聲音api

## Background

When an operator runs `next dev`, ElevenLabs TTS (practice script + live, and `/tts`) must use the **platform** voice id stored in the same **local D1** that `/voices` edits — `elevenlabs_voices.voice_id`, reached via `characters.elevenlabs_voice_id` — not a leftover env name `ELEVENLABS_VOICE_ID`.

Already true (cite; **do not regress**):

- Voice catalog CRUD is shipped ([`docs/specs/voice-catalog.md`](./voice-catalog.md)). `characters.elevenlabs_voice_id` FK → `elevenlabs_voices.id`. Platform id is `elevenlabs_voices.voice_id`.
- `POST /api/elevenlabs` already: valid session → `resolveSessionVoiceId()` (session → scenario → character → voice) else `defaultVoiceId()` (`ORDER BY is_free DESC, id ASC`). Empty catalog → **400** `{ "error": "還沒有音色。請到音色目錄新增一顆。" }`.
- Product code does **not** read `process.env.ELEVENLABS_VOICE_ID` (grep `app/`, `lib/`, `components/`, `proxy.ts`). An operator’s local env may still define that unused name; TTS must never start reading it.
- `ELEVENLABS_API_KEY` stays env-only (`.env.local` / `.dev.vars` / `wrangler secret`). **Never** store keys in D1, this spec, or logs. Do **not** quote secret values. Do **not** commit `.env.local` / `.dev.vars`.
- `next dev` uses the **same local D1** as `wrangler d1 … --local` ([`docs/DATA.md`](../DATA.md) §1). No second SQLite for voices.
- `/tts` and settings already say the voice comes from the catalog / D1 (`音色從資料庫讀，請到音色目錄管理。` / `角色音色走 ElevenLabs，由音色目錄指定。…`). Gemini `VOICES` picker is unchanged.
- All **8** public scenarios ([`docs/SCENARIOS.md`](../SCENARIOS.md)) still point at character `bella`. Do **not** add a ninth scenario. Do **not** change public scenario `id`s.

Local footgun (in-scope, **AC5**): `migrations/0002_seed.sql` upserts seed internal id `bella` with `ON CONFLICT(id) DO UPDATE` for `elevenlabs_voices` (`voice_id`, `label`, `is_free`) and `characters` (`name`, `elevenlabs_voice_id`). `wrangler d1 execute fluently_db --local --file=migrations/0002_seed.sql` overwrites `/voices` edits (`migrations apply` will not re-run `0002`). This spec changes those two catalog upserts to `DO NOTHING`. Scene / scenario upserts stay as they are.

This spec is **backend-only**. **New work is AC5 only** (`0002` catalog `DO NOTHING` + `DATA.md`). AC1–AC4 already hold on the shipped route and helpers — they are **must-not-regress locks**, not a rewrite. Do **not** edit `app/api/elevenlabs/route.ts` or `lib/db.ts`. Frontend must not regress catalog copy and must not start reading `ELEVENLABS_VOICE_ID`.

## User stories

1. As an operator on `next dev`, I want practice chat (script and live) ElevenLabs TTS to use the platform id on the scenario’s character in local D1, so `/voices` is the only voice picker.
2. As an operator, I want `/tts` (no `scenarioId`) to use `defaultVoiceId()` from that same D1, so the tester matches the catalog, not env.
3. As an operator, after I PATCH a voice’s `voiceId` or a character’s assignment on `/voices`, I want the next `POST /api/elevenlabs` `x-voice` to be the new platform id, with no env fallback.
4. As an operator, I want `wrangler d1 execute … --file=migrations/0002_seed.sql` to leave existing `elevenlabs_voices` and `characters` rows alone, so my catalog edits survive that local re-seed.
5. As a learner or operator, I still get **401** `請先登入` when unauthenticated, and the existing env key error when `ELEVENLABS_API_KEY` is missing — never a key from D1.

## Acceptance criteria

AC1–AC4 are **already true** on the shipped `POST /api/elevenlabs` and `lib/db.ts` helpers. They are **must-not-regress locks**. Backend must **not** rewrite the route or helpers to satisfy them. **New work is AC5 only.**

- [ ] **AC1 (already true — lock):** Logged-in `POST /api/elevenlabs` with a known public `scenarioId` (e.g. `cafe`) and `text` succeeds (key present, catalog non-empty). Success header **`x-voice`** is that scenario’s character’s assigned **`elevenlabs_voices.voice_id`** (ElevenLabs **platform** id). It is **not** the internal catalog `id` (seed character / voice PK `bella`). Same for `mode: "script"` and `mode: "live"`. Resolution is `createSession` / existing `sessionId` → `resolveSessionVoiceId()` only. Body must **not** accept `voice`, `voiceId`, or `ELEVENLABS_VOICE_ID` as a picker; extra keys are ignored. Client `speakReply()` already omits a voice field; do not add one. Do not document a platform id value.

- [ ] **AC2 (already true — lock):** Logged-in `POST /api/elevenlabs` **without** `scenarioId` / without a resolvable session (the `/tts` tester) uses `defaultVoiceId()` at **request** time. Success `x-voice` equals `SELECT voice_id FROM elevenlabs_voices ORDER BY is_free DESC, id ASC LIMIT 1` (trim; empty → treat as missing) — again the **platform** `voice_id`, not internal `id`. `/tts` page still calls `defaultVoiceId()` only to display **預設音色（資料庫，偏好免費）**; the tester must not send that display value as an override. Do **not** change the `is_free DESC, id ASC` rule.

- [ ] **AC3 (already true — lock):** After `PATCH /api/voices/:id` with a new `voiceId`, the next matching `POST /api/elevenlabs` `x-voice` equals the current D1 platform `voice_id` for that row. After `PATCH /api/characters/:id` with a new `elevenlabsVoiceId`, the next practice POST for a scenario that uses that character has `x-voice` equal to the newly assigned row’s platform `voice_id`. Grep `app/`, `lib/`, `components/`, `proxy.ts` for `ELEVENLABS_VOICE_ID`: **zero** matches (no `process.env` read, no other read). Do not write or commit `.env.local`. Do not quote a platform id or `ELEVENLABS_VOICE_ID` value. In-memory `speakReply` clip cache (same text, same tab) is an existing [`docs/DATA.md`](../DATA.md) §7 limit and **out of scope**; this AC is the **HTTP** POST.

- [ ] **AC4 (already true — lock):** Unauthenticated `POST /api/elevenlabs` → **401** `{ "error": "請先登入" }`; no D1 write; no provider call. Missing / blank `ELEVENLABS_API_KEY` after a valid session → existing **401** `{ "error": "還沒有 ElevenLabs API key。在 .env.local 設 ELEVENLABS_API_KEY。" }` (env-only; not from D1; do not invent a new string). Empty `elevenlabs_voices` → **400** `{ "error": "還沒有音色。請到音色目錄新增一顆。" }`. Empty `text` → **400** `{ "error": "沒有要唸的內容" }`. Invalid JSON → **400** `{ "error": "請求格式錯誤" }`. Key never in JSON, D1, `api_calls`, or `api_logs`.

- [ ] **AC5 (new work — seed must not clobber `/voices`; DATA.md):** In `migrations/0002_seed.sql` **only**, change the `elevenlabs_voices` and `characters` statements from `ON CONFLICT(id) DO UPDATE` to **`ON CONFLICT(id) DO NOTHING`**. Keep the existing seed `INSERT` values (first apply / empty DB still inserts internal id `bella`). Do **not** rewrite `0001_init.sql`. Do **not** change scene / scenario upserts. Do **not** add a new migration. Do **not** delete `d1_migrations`. `wrangler d1 migrations apply` will **not** re-run `0002`. Re-seed proof: after a `/voices` edit, `wrangler d1 execute fluently_db --local --file=migrations/0002_seed.sql` must leave existing `elevenlabs_voices` and `characters` rows unchanged. Update the file comment: catalog rows are insert-if-missing so `/voices` edits survive that `d1 execute --file=…` re-seed. **Same backend commit** updates [`docs/DATA.md`](../DATA.md): `next dev` TTS reads local D1 catalog only; env name `ELEVENLABS_VOICE_ID` is never a picker; `ELEVENLABS_API_KEY` still env-only; `0002` catalog upserts are `DO NOTHING`; re-seed is `d1 execute --file=…`, not `migrations apply`. No `.env.local` / `.dev.vars` **contents**. Do **not** edit [`docs/SCENARIOS.md`](../SCENARIOS.md). Do **not** add a ninth scenario. Do **not** change public scenario `id`s (`cafe`, `directions`, `small-talk`, `hotel`, `clinic`, `phone-interview`, `interview`, `debate`).

## Frontend / backend fields

Backend-only. Frontend has **no** new fields or copy in this spec.

| Field | Source | Type | Notes |
|---|---|---|---|
| `elevenlabs_voices.voice_id` | D1 | `string` | ElevenLabs **platform** id. Success `x-voice`. Not a secret. Not the internal `id`. |
| `elevenlabs_voices.id` | D1 PK | `string` | Internal kebab (seed `bella`). FK target. |
| `elevenlabs_voices.is_free` | D1 `0`\|`1` | integer | `defaultVoiceId()` prefers `1`, then `id ASC`. Unchanged. |
| `characters.elevenlabs_voice_id` | D1 FK | `string` | → `elevenlabs_voices.id`. Practice path uses this join. |
| `scenarios.character_id` | D1 FK | `string` | Unchanged. Public scenario `id`s unchanged. |
| `scenarioId` | POST body | `string` | Practice script/live. Known id → session + `resolveSessionVoiceId()`. |
| `sessionId` | POST body / `x-session-id` | `string` \| omitted | Reused when it exists for `user.id`; else created when `scenarioId` is valid. |
| `mode` | POST body | `"script"` \| `"live"` | Session mode only; does not pick a voice. |
| `text` | POST body | `string` | Required after trim. |
| `model` | POST body / env `ELEVENLABS_MODEL` | `string` | Unchanged; not a voice picker. |
| `x-voice` | Response header | platform `voice_id` | Observable picker result. |
| `ELEVENLABS_API_KEY` | env / Worker secret | string | **Only** secret this route reads. Never D1 / logs / this spec’s values. |
| `ELEVENLABS_VOICE_ID` | unused env **name** | — | Must not be read. Do not document a value. Do not commit `.env.local`. |

Do **not** edit [`lib/db.ts`](../../lib/db.ts) or [`app/api/elevenlabs/route.ts`](../../app/api/elevenlabs/route.ts). `resolveSessionVoiceId()` / `defaultVoiceId()` and the route stay as shipped. `lib/elevenlabs.ts` still receives `voiceId` as an argument and must not read env (key or voice).

### File ownership (avoid same-file edits)

| Owner | Paths |
|---|---|
| Backend | `migrations/0002_seed.sql` (catalog upserts + comment only), `docs/DATA.md` |
| Frontend | **None.** Do not edit `/tts`, tester, settings, `speakReply`, or Gemini `VOICES`. Do not regress voice-catalog copy. Do not edit `app/api/elevenlabs/route.ts` or `lib/db.ts`. |

If both roles would need the same file, **stop** and write it in Next Step — do not dual-edit.

## Errors

| Case | User-visible | API / log |
|---|---|---|
| No session | `{ "error": "請先登入" }` | **401**; no D1 write; no provider call |
| Missing / blank `ELEVENLABS_API_KEY` | `{ "error": "還沒有 ElevenLabs API key。在 .env.local 設 ELEVENLABS_API_KEY。" }` | **401**; key never logged; not from D1 |
| Invalid JSON | `{ "error": "請求格式錯誤" }` | **400** |
| Empty `text` | `{ "error": "沒有要唸的內容" }` | **400** |
| Empty catalog (no resolvable platform id) | `{ "error": "還沒有音色。請到音色目錄新增一顆。" }` | **400** |
| Voice Library / 402 (unchanged) | existing ElevenLabs copy | existing status; no key in body |

Do not add a user-visible error for “env voice ignored”. Unused `ELEVENLABS_VOICE_ID` is silent.

## Non-goals

- Frontend work, new `/voices` UI, or changing Gemini `VOICES` / `/api/speak` / settings source `gemini` \| `browser`.
- Per-user voices, a ninth scenario, renaming public scenario `id`s, creating/deleting characters.
- Rewriting `0001_init.sql`; changing scene/scenario seed upserts; runtime `ALTER`; a second local SQLite; a new migration; deleting `d1_migrations`.
- Editing `app/api/elevenlabs/route.ts` or `lib/db.ts` (AC1–AC4 locks only).
- Storing `ELEVENLABS_API_KEY` (or any secret) in D1, specs, or logs; quoting env **values**; committing `.env.local` / `.dev.vars`.
- Changing `defaultVoiceId()` ordering, empty-catalog copy, or catalog REST from voice-catalog.
- Invalidating the in-memory `speakReply` clip cache after a catalog PATCH.
- Calling ElevenLabs to validate `voice_id` (a bad platform id still fails at synthesize, as today).

## Handoff

- Goal: Keep shipped D1 voice resolution (AC1–AC4). New work: `0002` catalog upserts become `DO NOTHING` so `d1 execute --file=…` cannot overwrite `/voices`; document that in `DATA.md`.
- Changes: `docs/specs/local-d1-elevenlabs-voice.md` (this file). `docs/SCENARIOS.md` unchanged.
- Next Step: QA spec review (`qa` subagent)
