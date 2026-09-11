# Spec QA: agent-loop-board

- Slug: `agent-loop-board`
- review_pass: **1** (diff review)
- Result: **PASS**
- Scope: `git diff` + untracked feature files vs `docs/specs/agent-loop-board.md`. No product code.

Compared implementation to every AC. Tagged owners only where a Must-fix exists (none this pass).

---

## Must-fix: none

---

## AC vs diff

| AC | Result | Notes |
|---|---|---|
| AC1 unauthenticated | PASS | `proxy.ts` matcher has `/runs` and `/runs/:path*` (frontend-only). Live: `GET /runs` and `GET /runs/abc` → **307** `/login?redirect=…`. `GET`/`POST`/`PATCH` `/api/runs*` → **401** `{ "error": "請先登入" }` before agent tables. Pages `getCurrentUser()` + `redirect("/login")`. |
| AC2 tokens NULL vs 0 | PASS | Omit/`null` → SQL NULL; `"12"` / negative / non-integer → 400 `token 必須是整數或空值`, no row. UI `U+2014` via `formatToken`. `SUM` (not `TOTAL`); list tile `knownTokensTotal` is NULL when every listed sum is NULL. Not written to `api_calls`. |
| AC3 owner scope | PASS | All helpers filter `user_id`. Missing / other user → API **404** `{ "error": "找不到這筆執行" }`; page copy `找不到這筆執行。` + `← 需求執行` (no `not-found.tsx`, no `notFound()`). |
| AC4 stage / difficulties / decisions | PASS | RSC `dynamic = "force-dynamic"`, imports `getAgentRun`. `尚未開始` when `latest_role` is NULL; else `{roleLabel} · {kindLabel} · 第 {n} 次` + status chip. Difficulty / decision empty copy exact. Native `<details>`/`<summary>`. |
| AC5 validation + secrets | PASS | Trim-empty / missing `sourceRequest` → 400 `需求內容是空的`. Unknown enums / `reviewPass` not 1\|2 / `specSlug` > 128 / empty PATCH → `欄位不正確`. Prefixes `API_KEY=` / `CLIENT_SECRET=` / `BETTER_AUTH_SECRET=` / `ELEVENLABS_API_KEY=` → 400 `內容含有密鑰，未寫入`, no INSERT, body not echoed. |
| AC6 skill contract | PASS | `.cursor/skills/fluently-feature-loop/SKILL.md` **Board log (required)** requires `POST /api/runs` at start, `POST /api/runs/:id/turns` after each subagent (required `role`/`kind`/`reviewPass`/`outcome`, tokens `null` if unknown), `difficultyKind` for Must-fix / STOP leftovers / same-file orchestrator tuple, `PATCH` `passed`\|`stopped` at end. |
| AC7 schema isolation | PASS | `migrations/0005_agent_loop.sql` only. `docs/DATA.md` documents tables, indexes, helpers, and “不要把角色迴圈併進 `api_calls`”. `appendAgentTurn` does not call `recordCall` / `logApiCall`. |
| AC8 list + tiles + tokens | PASS | DESIGN tokens only (no hex / `rgb()` / `dark:`). Layout matches `/usage`. Zero runs: dashed empty card only, no zero tiles. Non-zero: four tiles, hero 進行中 is `text-clay`. **user-menu and settings-menu** both link **需求執行** → `/runs` next to 用量統計. Copy table matches. |

Pages import snake_case `lib/db.ts` helpers; they do not `fetch` `/api/runs`. JSON is camelCase wrap of the same fields.

---

## Should-fix (do not produce)

1. **user-menu** puts 需求執行 *after* 用量統計; **settings-menu** puts it *before*. Both are adjacent as AC8 requires.
2. Empty HTTP body on `POST /api/runs` returns `請求格式錯誤` (`{}` correctly returns `需求內容是空的`).
3. Spec `Status` is still `draft` (leftover from spec review). Does not affect the board.

---

## Runnable checklist

Apply local schema if this clone has not yet:

```bash
npx wrangler d1 migrations apply fluently_db --local
```

```bash
npm run build && npm run lint
```

Unauthenticated (no session cookie):

```bash
# 307 /login?redirect=/runs
curl -sI http://localhost:3000/runs | grep -i location
# 307 /login?redirect=/runs/<id>
curl -sI http://localhost:3000/runs/does-not-exist | grep -i location
# 401 {"error":"請先登入"} — GET / POST / PATCH / turns
curl -s -w '\n%{http_code}\n' http://localhost:3000/api/runs
curl -s -w '\n%{http_code}\n' -X POST http://localhost:3000/api/runs \
  -H 'content-type: application/json' -d '{"sourceRequest":"x"}'
curl -s -w '\n%{http_code}\n' -X PATCH http://localhost:3000/api/runs/x \
  -H 'content-type: application/json' -d '{"status":"passed"}'
curl -s -w '\n%{http_code}\n' -X POST http://localhost:3000/api/runs/x/turns \
  -H 'content-type: application/json' \
  -d '{"role":"pm","kind":"produce","reviewPass":1,"outcome":"ok"}'
```

Logged-in (browser session cookie as `COOKIE`):

```bash
# 400 需求內容是空的 — no row
curl -s -w '\n%{http_code}\n' -X POST http://localhost:3000/api/runs \
  -H "cookie: $COOKIE" -H 'content-type: application/json' \
  -d '{"sourceRequest":"   "}'

# 400 token 必須是整數或空值 — string not coerced
curl -s -w '\n%{http_code}\n' -X POST "http://localhost:3000/api/runs/$ID/turns" \
  -H "cookie: $COOKIE" -H 'content-type: application/json' \
  -d '{"role":"pm","kind":"produce","reviewPass":1,"outcome":"ok","tokensIn":"12"}'

# omit tokens → persist NULL; UI shows — not 0
curl -s -X POST "http://localhost:3000/api/runs/$ID/turns" \
  -H "cookie: $COOKIE" -H 'content-type: application/json' \
  -d '{"role":"pm","kind":"produce","reviewPass":1,"outcome":"ok"}'

# 400 內容含有密鑰，未寫入 — response must not echo the prefix value
curl -s -w '\n%{http_code}\n' -X POST http://localhost:3000/api/runs \
  -H "cookie: $COOKIE" -H 'content-type: application/json' \
  -d '{"sourceRequest":"demo API_KEY=not-a-real-key"}'

# other-user or unknown id → 404 找不到這筆執行 (not 403)
curl -s -w '\n%{http_code}\n' "http://localhost:3000/api/runs/00000000-0000-0000-0000-000000000000" \
  -H "cookie: $COOKIE"
```

In the browser, logged in:

- [ ] User menu and settings menu both show **需求執行** → `/runs`.
- [ ] `/runs` with no rows: only `還沒有任何需求執行紀錄。` — no four tiles of zeros.
- [ ] `/runs` with rows: tiles 進行中 / 已完成 / 已停止 / 已知 token; 進行中 number is clay; each row has chip + stage + truncated request + `輸入 · 輸出` + link.
- [ ] `/runs/<unknown>`: `找不到這筆執行。` and `← 需求執行`.
- [ ] Detail: `尚未開始` before first turn; difficulties / 決策 empty copy; tokens `—` per NULL side; `/usage` Gemini totals unchanged.

---

## Handoff

- Goal: Diff-review the agent-loop board against every AC (auth, NULL tokens, owner 404, secrets, isolation from `api_calls`, DESIGN tokens, exact copy, both menus, skill POST `/api/runs` + turns).
- Changes: this file → **PASS**; Must-fix none. Spec review 2 PASS still stands.
- Next Step: **review_pass: 1 · PASS** — no frontend/backend fix round. Feature loop for this spec is done.
