# Spec: Voice catalog

- Slug: `voice-catalog`
- Status: draft
- Source request: 後台頁能新增／改／刪 elevenlabs_voices，並把 characters 指到哪顆音色。登入才能進（與 /tts /logs 相同）。這是全域目錄（不是每使用者一把聲音）。

## Background

Fluently already stores a **global** ElevenLabs catalog in D1 ([`docs/DATA.md`](../DATA.md)):

- `elevenlabs_voices` — internal `id` (PK), platform `voice_id`, `label`, `is_free`
- `characters` — `id`, `name`, `elevenlabs_voice_id` FK → `elevenlabs_voices.id`

Seed (`migrations/0002_seed.sql`) has one voice and one character, both `bella`. All **8** public scenarios ([`docs/SCENARIOS.md`](../SCENARIOS.md)) point at character `bella`. Runtime TTS already reads the catalog: `resolveSessionVoiceId()` (session → scenario → character → voice) and `defaultVoiceId()` (`ORDER BY is_free DESC, id ASC`). `ELEVENLABS_API_KEY` stays env-only (`.env.local` / `.dev.vars` / `wrangler secret`). Env `ELEVENLABS_VOICE_ID` **already does not** pick a voice.

There is **no** admin UI. `/tts` still tells the operator to set `ELEVENLABS_VOICE_ID` in `.env.local` ([`components/elevenlabs-tts-tester.tsx`](../../components/elevenlabs-tts-tester.tsx)); the settings menu still says 「.env 的 voice」. Both are stale.

This spec adds a logged-in catalog page so an operator can CRUD voices and **re-point existing characters**. The catalog is **one shared table for the whole app**, not a per-user voice. Any signed-in user who can open `/tts` can edit it; a change applies to every learner’s later ElevenLabs TTS.

Do **not** invent a ninth scenario. Do **not** change public scenario `id`s. Do **not** put secrets, API keys, or Client Secrets in D1, logs, or this spec. Known env **names** may appear; **values** must not.

UI follows [`docs/DESIGN.md`](../DESIGN.md): tokens only, no hex, no `dark:`. Schema already exists in `0001_init.sql` / `0002_seed.sql` — **do not rewrite those files**.

## User stories

1. As a logged-in operator, I want a `/voices` page (gated like `/tts` / `/logs`) so I can manage the shared ElevenLabs catalog without editing SQL.
2. As a logged-in operator, I want to create, update, and delete `elevenlabs_voices` rows (`id`, `voice_id`, `label`, `is_free`) so I can add a library or premade voice and mark whether the free plan can use it.
3. As a logged-in operator, I want to see each character’s name and pick which catalog voice it uses so Bella (today the only character) can point at a new row without a new scenario.
4. As a logged-in operator, I want delete blocked while a character still references that voice, and I want a character update refused if it would leave the character with no voice, so TTS joins do not break.
5. As a logged-in operator, I want `/tts` and the settings blurb to say the voice comes from this catalog / D1 (preferring `is_free`), not from `ELEVENLABS_VOICE_ID` in `.env.local`.

## Acceptance criteria

- [ ] **AC1 (auth + route + nav):** New page **`/voices`**. [`proxy.ts`](../../proxy.ts) `matcher` gains `/voices` and `/voices/:path*` (same cookie-only gate as `/tts`). **Frontend owns that matcher edit;** backend does not touch `proxy.ts`. Page loader calls `getCurrentUser()` and `redirect("/login")` if the cookie is present but invalid. Unauthenticated `GET /voices` → `/login?redirect=/voices`. Every `/api/voices*` and `/api/characters*` method without a valid session returns **401** `{ "error": "請先登入" }` (APIs are not in the matcher; auth is `getCurrentUser()` only). No D1 write on 401.
  - Compact `SiteHeader` (same as `/tts`). **Settings menu** gains **音色目錄** → `/voices` immediately above **ElevenLabs TTS 測試**.
  - `/tts` page gains a text link **音色目錄** → `/voices` (next to or under the existing `← API 呼叫紀錄` link).
  - `/voices` page gains `← ElevenLabs TTS 測試` → `/tts`.
  - Page title **音色目錄 — Fluently**. `h1` **音色目錄** (`font-display text-[36px] sm:text-[44px]`). Lead (exact): **全域的 ElevenLabs 音色與人物指派。登入者看到的是同一份目錄，改了會影響之後所有練習的角色聲音。**

- [ ] **AC2 (list + create + update + delete voices):** Logged-in `/voices` shows every `elevenlabs_voices` row (`ORDER BY id ASC`) and a create form. Fields are [Voice fields](#voice-fields). Mutations go through REST in [API contract](#api-contract) (JSON camelCase). After a successful mutate, the list refreshes (refetch GET or equivalent) so the new row / edit / removal is visible without a full navigation that loses form errors.
  - **Create:** `POST /api/voices` **201** `{ "voice": <VoiceJSON> }` and one new D1 row. `id` is the PK and **immutable** after insert (PATCH identity is the URL; extra body `id` is ignored).
  - **Update:** `PATCH /api/voices/:id` **200** `{ "voice": <VoiceJSON> }`. At least one of `voiceId` / `label` / `isFree`. `is_free` checkbox maps to JSON boolean; D1 stores `0` | `1`.
  - **Delete:** `DELETE /api/voices/:id` **204** empty body when no `characters.elevenlabs_voice_id` equals that `id`. Then the row is gone from GET and from the page.
  - **Empty catalog:** dashed empty card (usage/runs pattern) copy **還沒有任何音色。** plus the create form. (Seed `bella` means this is rare; still required.)
  - DESIGN tokens only (`bg-canvas`, `bg-surface`, `bg-surface-2`, `text-ink`, `text-ink-soft`, `text-ink-muted`, `border-line`, `border-line-strong`, `bg-clay`, `bg-clay-deep`, `text-on-clay`, `bg-clay-wash`, `shadow-[var(--shadow)]`, …). **No** bare hex / `rgb()`, **no** `dark:`. No new DESIGN tokens. Cards use the DESIGN card recipe; primary submit is the clay pill; secondary/delete is the outline pill. `is_free = 1` shows a static chip **免費**. Internal `id` and platform `voice_id` use `font-mono`. Horizontal padding `px-5 sm:px-8`; container `max-w-3xl` (same reading width as `/tts`). Enter with `.rise`. Frontend updates [`docs/DESIGN.md`](../DESIGN.md) §7 in the **same** frontend commit (new `/voices` page + catalog component).

- [ ] **AC3 (characters: re-point voice, no empty FK):** Same page, second card titled **人物**. Lists every `characters` row (`ORDER BY id ASC`): display `name` (and `id` as muted mono) plus a `<select>` of catalog voices. Option `value` = voice internal `id`; option text = `{label}（{id}）`. Saving calls `PATCH /api/characters/:id` with `{ "elevenlabsVoiceId": "<voice.id>" }` → **200** `{ "character": <CharacterJSON> }`. D1 `characters.elevenlabs_voice_id` updates. Later `resolveSessionVoiceId()` for sessions of any scenario that uses that character must read the **new** platform `voice_id` (no scenario `id` change).
  - **Cannot leave a character without a voice:** missing / null / blank `elevenlabsVoiceId` after trim → **400** `{ "error": "人物必須指定一顆音色" }`. No D1 write. The select has no empty option.
  - Unknown voice id → **400** `{ "error": "找不到這顆音色" }` (not 404 — the character exists). No D1 write.
  - Unknown character id → **404** `{ "error": "找不到這個人物" }`.
  - Creating or deleting characters is a **non-goal**. Today only `bella` appears; that is enough.

- [ ] **AC4 (referential delete + validation, Traditional Chinese):** `DELETE /api/voices/:id` when `COUNT(*) FROM characters WHERE elevenlabs_voice_id = :id` ≥ 1 → **409** `{ "error": "還有人物在用這顆音色，請先改指派再刪" }`. Row stays. UI shows that `error` string (do not surface a raw SQLite FK message). Check in the app **before** relying on the FK. Other validation uses the exact strings in [Errors](#errors). JSON parse failure → **400** `{ "error": "請求格式錯誤" }`. Duplicate create `id` → **409** `{ "error": "這個內部代號已經存在" }` (PK collision; **not** 500). Unknown voice on GET/PATCH/DELETE `/api/voices/:id` → **404** `{ "error": "找不到這顆音色" }`.

- [ ] **AC5 (stale /tts + settings copy; `defaultVoiceId` still prefers `is_free`):** Do **not** change the `defaultVoiceId()` rule: `SELECT voice_id FROM elevenlabs_voices ORDER BY is_free DESC, id ASC LIMIT 1` (equivalent is ok; must still prefer `is_free = 1`, then `id ASC`). `/tts` still passes that platform id into `ElevenLabsTtsTester`.
  - Tester **must not** mention `ELEVENLABS_VOICE_ID` or ask the operator to put a voice in `.env.local`. Replace the empty-voice well with: **還沒有可用的音色。請到音色目錄新增一顆。** plus a link **音色目錄** → `/voices`. Field label becomes **預設音色（資料庫，偏好免費）**. Empty value text becomes **尚未設定**.
  - `/tts` intro may still say the **key** lives in `.env.local` and the browser hits `/api/elevenlabs`. Add one sentence (exact): **音色從資料庫讀，請到音色目錄管理。**
  - Settings menu ElevenLabs blurb becomes (exact): **角色音色走 ElevenLabs，由音色目錄指定。同一句重播不會再合成，失敗時退回瀏覽器語音。**
  - `POST /api/elevenlabs` when the catalog is empty becomes **400** `{ "error": "還沒有音色。請到音色目錄新增一顆。" }` (replaces the table-name sentence). Still no key in the body, D1, or logs.
  - `ELEVENLABS_API_KEY` remains env-only. This page never collects a key.

- [ ] **AC6 (global catalog + DATA.md, no new scenario):** Rows have **no** `user_id`. GET lists the same rows for every signed-in user. A PATCH/DELETE by user A is visible to user B on the next GET. Practice tables stay filtered by `user.id`; this catalog does not. Backend exports the [helpers](#libdbts-helpers) from [`lib/db.ts`](../../lib/db.ts) and implements the routes. **Same backend commit** updates [`docs/DATA.md`](../DATA.md): `/voices` page, REST paths, global (not per-user) scope, named helpers, `defaultVoiceId` unchanged, `/tts` no longer documents `ELEVENLABS_VOICE_ID` as the picker, key still env-only. Do **not** rewrite `0001_init.sql` / `0002_seed.sql`. No new migration unless a helper truly cannot run on the existing tables (it can). Do **not** edit [`docs/SCENARIOS.md`](../SCENARIOS.md). Do **not** add a ninth scenario. Do **not** change public scenario `id`s (`cafe`, `directions`, `small-talk`, `hotel`, `clinic`, `phone-interview`, `interview`, `debate`).

## API contract

Auth on every method: `getCurrentUser()`; failure **401** `{ "error": "請先登入" }`. Bodies are JSON. D1/helpers are **snake_case**; JSON is **camelCase** of the same names.

| Method | Path | Success | Body |
|---|---|---|---|
| `GET` | `/api/voices` | **200** `{ "voices": VoiceJSON[] }` | — |
| `POST` | `/api/voices` | **201** `{ "voice": VoiceJSON }` | `{ id, voiceId, label, isFree? }` |
| `PATCH` | `/api/voices/:id` | **200** `{ "voice": VoiceJSON }` | `{ voiceId?, label?, isFree? }` (≥1) |
| `DELETE` | `/api/voices/:id` | **204** | — |
| `GET` | `/api/characters` | **200** `{ "characters": CharacterJSON[] }` | — |
| `PATCH` | `/api/characters/:id` | **200** `{ "character": CharacterJSON }` | `{ elevenlabsVoiceId }` |

`GET` lists `ORDER BY id ASC`. Extra unknown JSON keys are ignored. `POST /api/voices` omitted `isFree` → store `0`.

These routes do **not** write `api_calls` or `api_logs` (no provider call).

### `VoiceJSON`

```ts
type VoiceJSON = {
  id: string;
  voiceId: string;
  label: string;
  isFree: boolean;
};
```

### `CharacterJSON`

```ts
type CharacterJSON = {
  id: string;
  name: string;
  elevenlabsVoiceId: string;
};
```

## Frontend / backend fields

### Voice fields

| Field | Source | Type | Notes |
|---|---|---|---|
| `id` | UI create / API / D1 PK | `string` | Internal kebab. Create only. Path param on PATCH/DELETE. Regex `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`. After trim, length 1–64. Seed `bella` is valid. |
| `voice_id` / `voiceId` | UI / API / D1 | `string` | ElevenLabs **platform** id (e.g. seed Bella). After trim, length 1–128. Not a secret. Not the internal `id`. |
| `label` | UI / API / D1 | `string` | Human name. After trim, length 1–80. |
| `is_free` / `isFree` | UI checkbox / API boolean / D1 `INTEGER` 0\|1 | `boolean` | `defaultVoiceId()` prefers `1`. Create default `false` / `0`. |

### Character fields

| Field | Source | Type | Notes |
|---|---|---|---|
| `id` | D1 PK / JSON | `string` | Read-only on this page. Seed `bella`. |
| `name` | D1 / JSON | `string` | Display only. This spec does not PATCH `name`. |
| `elevenlabs_voice_id` / `elevenlabsVoiceId` | UI select / API / D1 FK | `string` | Must be an existing `elevenlabs_voices.id`. Required; never empty. |

### `lib/db.ts` helpers

Backend **must** export these. Frontend does **not** write `lib/db.ts`. Pages **may** `fetch` the APIs only (preferred for parallel work); they must not invent a second schema.

| Export | Returns | Notes |
|---|---|---|
| `listVoices()` | `VoiceRow[]` | All rows, `id ASC`. No user filter. |
| `getVoice(id)` | `VoiceRow \| undefined` | |
| `insertVoice({ id, voice_id, label, is_free })` | `VoiceRow` | `is_free` is `0` \| `1`. PK clash → throw/return that the route maps to 409. |
| `updateVoice(id, patch)` | `VoiceRow \| undefined` | `undefined` if missing. Patch keys `voice_id?`, `label?`, `is_free?`. |
| `countCharactersUsingVoice(id)` | `number` | `COUNT(*)` on `characters.elevenlabs_voice_id`. |
| `deleteVoice(id)` | `'ok' \| 'not_found' \| 'in_use'` | `in_use` when count ≥ 1; **no** DELETE in that case. |
| `listCharacters()` | `CharacterRow[]` | All rows, `id ASC`. No user filter. |
| `getCharacter(id)` | `CharacterRow \| undefined` | |
| `updateCharacterVoice(id, elevenlabs_voice_id)` | `CharacterRow \| undefined` | `undefined` if character missing. Route must 400 when the voice id is missing/blank or `getVoice` is empty **before** UPDATE. |

`VoiceRow`: `{ id, voice_id, label, is_free }` with `is_free` `0` \| `1`.  
`CharacterRow`: `{ id, name, elevenlabs_voice_id }`.

`defaultVoiceId()` and `resolveSessionVoiceId()` stay exported and keep today’s join / `ORDER BY` behaviour.

### File ownership (avoid same-file edits)

| Owner | Paths |
|---|---|
| Frontend | `app/voices/**`, catalog client component, `app/tts/page.tsx`, `components/elevenlabs-tts-tester.tsx`, `components/settings-menu.tsx`, `proxy.ts` matcher, `docs/DESIGN.md` §7 |
| Backend | `app/api/voices/**`, `app/api/characters/**`, `lib/db.ts` helpers, `app/api/elevenlabs/route.ts` empty-catalog copy, `docs/DATA.md` |

If both roles would need the same file, **stop** and write it in Next Step — do not dual-edit.

## Errors

| Case | User-visible | API / log |
|---|---|---|
| No session on page | Redirect `/login?redirect=/voices` | proxy matcher; no API body |
| No session on API | `{ "error": "請先登入" }` | **401**; no D1 write |
| Invalid JSON | `{ "error": "請求格式錯誤" }` | **400** |
| Create `id` missing/blank | `{ "error": "內部代號不能空白" }` | **400** |
| Create `id` not kebab or length > 64 | `{ "error": "內部代號必須是小寫英文、數字與連字號" }` | **400** |
| Create `id` already exists | `{ "error": "這個內部代號已經存在" }` | **409** |
| `voiceId` missing/blank or length > 128 | `{ "error": "ElevenLabs 音色代號不能空白" }` | **400** |
| `label` missing/blank or length > 80 | `{ "error": "名稱不能空白" }` | **400** |
| Create/PATCH `isFree` present but not JSON boolean | `{ "error": "免費標記無效" }` | **400** |
| PATCH voice with no updatable field | `{ "error": "沒有要更新的欄位" }` | **400** |
| Voice id not found (GET/PATCH/DELETE `/api/voices/:id`) | `{ "error": "找不到這顆音色" }` | **404** |
| Delete voice still referenced | `{ "error": "還有人物在用這顆音色，請先改指派再刪" }` | **409**; row remains |
| Character id not found | `{ "error": "找不到這個人物" }` | **404** |
| Character PATCH missing/blank voice | `{ "error": "人物必須指定一顆音色" }` | **400** |
| Character PATCH voice does not exist | `{ "error": "找不到這顆音色" }` | **400** |
| Empty catalog on `POST /api/elevenlabs` | `{ "error": "還沒有音色。請到音色目錄新增一顆。" }` | **400** |
| Missing ElevenLabs key (unchanged) | existing `/api/elevenlabs` copy | **401**; key never logged |

UI shows the API `error` string in the existing clay-wash / surface-2 error well pattern (`/tts` tester). No secret values in responses, D1, or `api_logs`.

## Non-goals

- Per-user voices, `user_id` on `elevenlabs_voices` / `characters`, or cloning the catalog per learner.
- Creating, renaming, or deleting **characters**; changing `scenarios.character_id`; adding a ninth scenario; renaming public scenario `id`s.
- Rewriting `migrations/0001_init.sql` or `0002_seed.sql`; runtime `ALTER`; a new SQLite file.
- Collecting or storing `ELEVENLABS_API_KEY` (or any Gemini / OAuth secret) on this page or in D1.
- Changing Gemini TTS `VOICES` in the settings menu, `/api/speak`, or `defaultVoiceId()`’s `is_free`-first ordering.
- Calling ElevenLabs to validate `voice_id` (a bad platform id fails later at `/api/elevenlabs` / chat TTS, as today).
- Writing `api_calls` / `api_logs` for catalog CRUD.
- Admin roles beyond “any logged-in user”, like `/tts` and `/logs`.

## Handoff

- Goal: Logged-in operators manage the shared ElevenLabs voice catalog and point characters at a voice, without env voice ids or a ninth scenario.
- Changes: `docs/specs/voice-catalog.md` (this file). `docs/SCENARIOS.md` unchanged.
- Next Step: QA spec review (`qa` subagent)
