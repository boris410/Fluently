# Diff QA: local-d1-elevenlabs-voice

- Slug: `local-d1-elevenlabs-voice`
- review_pass: **1** (diff review)
- Result: **PASS**
- Spec: [`docs/specs/local-d1-elevenlabs-voice.md`](./local-d1-elevenlabs-voice.md)
- Scope: `git diff` / `git status` vs **AC5** (new work) and AC1–AC4 already-true locks. Frontend is **None**. No product code in this review.
- Spec review: already **PASS** (prior pass 2). This file is now the implementation checklist.

Must-fix: **none** (backend). Frontend: **None**.

---

## Must-fix: none

| Check | Owner | Result |
|---|---|---|
| `0002` `elevenlabs_voices` + `characters` → `ON CONFLICT(id) DO NOTHING` | backend | PASS — both statements. Seed `INSERT` values kept (internal id `bella`). |
| Scene / scenario upserts still `DO UPDATE` | backend | PASS — `scenes` and `scenarios` blocks unchanged. |
| No new migration; no `0001` rewrite; no `d1_migrations` delete | backend | PASS — only `migrations/0002_seed.sql` in `migrations/`. `0001_init.sql` / `0001_schema_update.sql` / `docs/SCENARIOS.md` not in the diff. |
| `0002` comment: insert-if-missing so `/voices` survives `d1 execute --file` | backend | PASS — names `wrangler d1 execute fluently_db --local --file=migrations/0002_seed.sql`; notes `migrations apply` will not re-run `0002`. |
| `DATA.md`: local D1 catalog; `ELEVENLABS_VOICE_ID` never a picker (name only, no value); `ELEVENLABS_API_KEY` env-only; re-seed is `d1 execute --file`, not `migrations apply` | backend | PASS — §遷移與種子 + §4. No `.env.local` / `.dev.vars` contents. No platform id string. |
| No secrets in diff | backend | PASS — names only. Seed platform id not copied into `DATA.md`. |
| `app/api/elevenlabs/route.ts` and `lib/db.ts` not rewritten for this spec | backend | PASS — AC5 did not change voice resolution. `resolveSessionVoiceId()` / `defaultVoiceId()` SQL unchanged (`is_free DESC, id ASC`). Route still `resolveSessionVoiceId() ?? defaultVoiceId()`, no body picker. Working-tree diffs on those two files are the already-shipped voice-catalog produce (empty-catalog copy + catalog helpers), not an AC1–AC4 rewrite. |
| AC1–AC4 locks (grep / errors / `x-voice`) | backend | PASS — `ELEVENLABS_VOICE_ID` has **zero** matches in `app/`, `lib/`, `components/`, `proxy.ts`. Route still 401/400 strings from the spec. Public scenario ids unchanged (8). |

---

## Should-fix (do not produce, do not STOP)

1. The working tree still has voice-catalog files (`/voices`, catalog routes, `/tts` copy, `DESIGN.md`). Out of this spec. Do not revert `route.ts` / `lib/db.ts` to “satisfy” the lock — that would undo voice-catalog.
2. `DATA.md` also documents catalog REST / helpers (voice-catalog AC6). Harmless; not an AC5 hole.

---

## Runnable checklist

Do **not** add a test framework. Do **not** quote a platform id or env **value**. Do **not** commit `.env.local` / `.dev.vars`.

### Build

```bash
npm run build && npm run lint
```

### AC5 re-seed proof (`d1 execute --file`, not `migrations apply`)

`wrangler d1 migrations apply` will **not** re-run `0002`. Proof is execute-file after a catalog edit.

```bash
# 1. Snapshot
npx wrangler d1 execute fluently_db --local --command="SELECT id, voice_id, label, is_free FROM elevenlabs_voices ORDER BY id;"
npx wrangler d1 execute fluently_db --local --command="SELECT id, name, elevenlabs_voice_id FROM characters ORDER BY id;"

# 2. Simulate a /voices (and character) edit — use a probe string, not the seed platform id
npx wrangler d1 execute fluently_db --local --command="UPDATE elevenlabs_voices SET voice_id = 'qa-probe-not-seed', label = 'QA Probe' WHERE id = 'bella';"
npx wrangler d1 execute fluently_db --local --command="UPDATE characters SET name = 'QA Character' WHERE id = 'bella';"

# 3. Re-seed the way an operator would (this is the footgun AC5 closes)
npx wrangler d1 execute fluently_db --local --file=migrations/0002_seed.sql

# 4. Catalog rows must still be the probe values (DO NOTHING)
npx wrangler d1 execute fluently_db --local --command="SELECT id, voice_id, label, is_free FROM elevenlabs_voices WHERE id = 'bella';"
npx wrangler d1 execute fluently_db --local --command="SELECT id, name, elevenlabs_voice_id FROM characters WHERE id = 'bella';"
```

Expect: `voice_id` still `qa-probe-not-seed`, `label` still `QA Probe`, character `name` still `QA Character`. Then put the catalog back from `/voices` (or a PATCH), not by copying a platform id into the shell history docs.

Optional: confirm scene/scenario still upsert (`DO UPDATE`) by checking a scene title is unchanged-or-restored after the same `--file` run.

### AC1–AC4 locks (already true — do not rewrite the route)

- [ ] Grep `ELEVENLABS_VOICE_ID` in `app/`, `lib/`, `components/`, `proxy.ts` → **zero** matches.
- [ ] Unauthenticated `POST /api/elevenlabs` → **401** `{ "error": "請先登入" }`.
- [ ] Logged-in, missing/blank `ELEVENLABS_API_KEY` → **401** `{ "error": "還沒有 ElevenLabs API key。在 .env.local 設 ELEVENLABS_API_KEY。" }`.
- [ ] Empty `text` → **400** `{ "error": "沒有要唸的內容" }`. Invalid JSON → **400** `{ "error": "請求格式錯誤" }`.
- [ ] Empty catalog → **400** `{ "error": "還沒有音色。請到音色目錄新增一顆。" }`.
- [ ] Logged-in POST with `scenarioId: "cafe"` success header `x-voice` equals that character’s current D1 **platform** `voice_id` (not internal `bella`). Same for `mode: "script"` and `"live"`. Extra body keys `voice` / `voiceId` / `ELEVENLABS_VOICE_ID` ignored.
- [ ] `/tts` tester POST (no `scenarioId`) `x-voice` equals `defaultVoiceId()` (`ORDER BY is_free DESC, id ASC`). After `PATCH /api/voices/:id` `{ "voiceId" }`, next matching POST `x-voice` is the new platform id.
- [ ] Key never in JSON, D1, `api_calls`, or `api_logs`.

---

## Handoff

- Goal: Diff-review AC5 (`0002` catalog `DO NOTHING` + `DATA.md`) and confirm AC1–AC4 locks (no route / `lib/db.ts` rewrite).
- Changes: this file → **PASS**; Must-fix none. Checklist includes `npm run build && npm run lint` and `d1 execute --file` re-seed proof.
- Next Step: **review_pass: 1 · PASS** — no backend fix. Frontend is **None**. Orchestrator can close the loop.
