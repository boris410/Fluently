# Spec QA: closing-intent

- Slug: `closing-intent`
- review_pass: **1** (diff review)
- Result: **PASS** (frontend + backend)
- Spec: [`docs/specs/closing-intent.md`](./closing-intent.md) AC1–AC5
- Scope: uncommitted `git status` / `git diff` vs AC1–AC5. No product code in this pass.
- `npm test` this pass: **12/12 passed**. `npm run build && npm run lint` not run here; still required before ship.

Must-fix: **none**. Should-fix does not start another produce.

---

## Must-fix: none

| Check (asked) | Owner | Result |
|---|---|---|
| `0007` `end_goal` unchanged (eight UPDATEs match End-goal copy) | backend | PASS — file untracked from prior end-intent work; strings match spec / seed / `npm test` |
| `0008` exact closing-intent strings; `ADD COLUMN … NOT NULL DEFAULT ''` then eight UPDATEs | backend | PASS |
| Judge **before** roleplay; not folded into `generateReply`; opening never judged | backend | PASS — `judgeClosing` after user append, before `generateReply`; one call per learner POST |
| `wrapUp` not `ended` | both | PASS — `ended` removed from schema / `GeminiResult` / chat **200**; client `parseWrapUp` only; leftover `ended: true` is continue |
| Parse both-false (`{"closing": true}` / miss / non-boolean / JSON fail) | backend | PASS — `parseJudgeFlags` zeros both + `valid: false` → `ok=0` then roleplay |
| `{ sessionId, outcome }` on review generate POST | both | PASS — cache first, then **400** `結束方式無效`; client always sends `{ sessionId, outcome }` |
| Once-gate (one `POST /api/review` per wrap-up) | frontend | PASS — `reviewClaimedRef` set before fetch; block / finish / stop / live **暫停** / **結束對話** share it; fail releases claim |
| Catalog test; no 9th scenario | backend | PASS — `npm test` 12/12; eight public ids |
| No secrets / keys in SQL, seed, logs, spec | both | PASS |
| Usage caption | frontend | PASS — `只計對話呼叫，不含語音合成、談話回饋與結束判斷。` |

---

## Should-fix (do not produce, do not STOP)

1. **backend** — Judge fixtures live in `scripts/closing-fixtures.ts`, not `scripts/fixtures/closing-judge.json`. Labels and 3–4 dialogues per id are present; `run-closing-judge.ts` is manual and not on `npm test`.
2. **frontend** — Script: 「🔊 唸給我聽」 on a *different* tutor bubble during a wrap-up wait does not match `autoReviewWaitRef.turnId`, so auto-review waits until **◼ 停止** / **結束對話**.
3. **frontend** — Live review generate fail: `onReviewBegin` already pauses and closes the mic; stay + error well is correct, but the stage stays paused until the learner taps **繼續**.

---

## Checked (AC1–AC5)

| AC | Check | Owner | Result |
|---|---|---|---|
| AC1 | `0008` only for `closing_intent`; did not rewrite `0001` / `0002` / `0007` | backend | PASS |
| AC1 | Seed `closingIntent` on `Scenario` + hydrate `sc.closing_intent` next to `endGoal` | backend | PASS |
| AC1 | `docs/SCENARIOS.md` field table, eight details, §5 all `—`, §7 judge vs roleplay; `docs/DATA.md` schema / `0008` / judge / `wrapUp` / `kind='judge'` / review `outcome` | backend | PASS |
| AC1 | `closingIntent` / `endGoal` never rendered (chips, cards, picker, header, stage, review) | frontend | PASS |
| AC2 | Last 6 after user append, oldest-first; no unwritten model line | backend | PASS — `getHistory` ASC then `sliceJudgeTurns` |
| AC2 | Shared judge rule once; independent flags; tokens from `usageMetadata` only | backend | PASS |
| AC2 | `kind='judge'` billed; 來回 / `getSessionStats` / `getUsageByScenario` stay `kind='chat'` | backend | PASS |
| AC2 | Judge fail → both false, `ok=0`, roleplay still runs; chat request not failed | backend | PASS |
| AC3 | Decision matrix + `closingTurn` shape; cap both-true still `completed` | backend | PASS — `decideWrapUp` |
| AC3 | Chat error `{ error, sessionId? }` has no `wrapUp` / `ended`; no auto-review | both | PASS |
| AC4 | Auto wrap-up sends `wrapUp.outcome`; **結束對話** with no pending wrap-up sends `"manual"` | frontend | PASS |
| AC4 | Store outcome on schedule; clear on new turn or `wrapUp: null`; keep after review fail | frontend | PASS |
| AC4 | Speech wait / blocked / stop / live `finish()` redirect on success; stay + error on fail | frontend | PASS |
| AC4 | Loading copy **正在整理這次練習的回饋…**; composer not locked after review | frontend | PASS |
| AC5 | `0009` `session_reviews.outcome` default `'manual'`; insert / get / RSC → `PracticeReview` | both | PASS |
| AC5 | Title/blurb exact; unreadable outcome → `manual`; `generateReview` does not take `outcome` | both | PASS |
| AC5 | Canonical `SessionReview` JSON unchanged (no `outcome` inside payload) | backend | PASS |
| — | Unauthenticated chat/review **401** `請先登入`; empty text **400**; unknown scenario **404** | backend | PASS (unchanged) |
| — | Same-file FE/BE split; `lib/gemini.ts` does not import DB | both | PASS |

---

## Runnable checklist

Apply local D1 first (once per machine):

```bash
npx wrangler d1 migrations apply fluently_db --local
```

Then:

```bash
npm run build && npm run lint && npm test
```

Manual (logged-in, Gemini key set):

1. **Blank input:** client `send("")` no-ops. Direct `POST /api/chat` with empty `text` → **400** `{ "error": "訊息是空的" }`.
2. **Unauthenticated:** `POST /api/chat` and `POST /api/review` without session → **401** `{ "error": "請先登入" }`; no Gemini / no judge.
3. **Unknown scenario:** `scenarioId: "nope"` → **404** `{ "error": "找不到這個情境" }`.
4. **Fields:** D1 `closing_intent` / `end_goal` / `session_reviews.outcome`. TS/JSON `closingIntent` / `endGoal` / `wrapUp` / `goal_met` / `closing` / `outcome`. Chat **200** has `wrapUp`, not `ended`. Error bodies omit both. UI never prints `closingIntent` or `endGoal`.
5. **Parse both-false:** judge `{"closing": true}` (no `goal_met`), bad JSON, or empty candidate → `kind='judge' ok=0`; conversation continues (`wrapUp: null` under the 12-turn cap).
6. **Both true:** short closing, no follow-up question → `wrapUp.outcome = "completed"` → title **你完成了這個情境**.
7. **Closing only:** short closing → `wrapUp.outcome = "incomplete"` → title **這次練習先停在這裡**.
8. **Only `goal_met` / both false (under cap):** partner asks a question; `wrapUp: null`; no auto-review.
9. **Script, will speak:** hear closing → natural finish → one **正在整理這次練習的回饋…** → in-place 建議 / 單字 / 文法 / 句子. One `POST /api/review` with `{ sessionId, outcome }`.
10. **Script, will not speak / autoplay blocked:** review starts when the line is on screen; do not wait for **🔊 點一下開啟聲音**.
11. **Live:** hear closing (or block/stop) → pause / mic close → on review **200/201** land on `/chat/{id}?session={id}&mode=script` with that review. Review fail: stay on live, **回饋沒有產生，請再試一次。**
12. **Once-gate:** during closing TTS, **暫停** then **結束對話** (or stop + **結束對話**) → Network shows **one** `POST /api/review`.
13. **Pending clear:** send another turn before auto-review → wait cancelled; later **結束對話** sends `"manual"`.
14. **Retry after fail (no later turn):** tap **結束對話** → resends stored `"completed"` / `"incomplete"`, not `"manual"`.
15. **Manual 結束對話** with no wrap-up: `"manual"`; title **這次練習的回饋**. Zero user turns → **至少說一句再結束，才有辦法給回饋。** and no review POST.
16. **Chat Gemini fail:** existing chat error; `kind='chat' ok=0`; no `wrapUp`; no auto-review. Judge row already written.
17. **Usage / logs:** `/usage` caption includes 結束判斷; per-scenario 來回 still `kind='chat'` only. `/logs` shows a `judge` operation after a learner turn.
18. **Catalog:** still eight public ids; `npm test` fails if a ninth appears or a copy string drifts.

---

## Handoff

- Goal: Diff review 1 of closing-intent against AC1–AC5.
- Changes: [`docs/specs/closing-intent-qa.md`](./closing-intent-qa.md) → **PASS**. Must-fix none. `npm test` 12/12 this pass.
- Next Step: `review_pass: 1`. **PASS** (frontend + backend). Do not call either role to fix. Should-fix: do not produce.
