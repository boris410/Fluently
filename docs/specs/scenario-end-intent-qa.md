# Spec QA: scenario-end-intent

- Slug: `scenario-end-intent`
- review_pass: **2** (diff review, last for frontend)
- Result: **PASS**
- Spec: [`docs/specs/scenario-end-intent.md`](./scenario-end-intent.md)
- Scope: uncommitted `git diff` after frontend produce 2 (once-gate release on failed review). No product code in this pass.

Must-fix: **none**. Pass-1 frontend Must-fix is closed. Backend remains **PASS**. Should-fix does not start another produce.

---

## Must-fix: none

Pass-1 item is closed in `claimAndRequestReview`:

| Required | Where | Closed |
|---|---|---|
| Failed `requestReview` (`!res.ok`, parse miss, network) clears `reviewClaimedRef` | `lib/use-conversation.ts` `claimAndRequestReview`: `if (result) … else reviewClaimedRef.current = false` | Yes |
| **結束對話** can POST again after 「回饋沒有產生，請再試一次。」 | Claim released only when result is `null`; button is enabled after `reviewPending` clears | Yes |
| In-flight still **one** `POST /api/review` | `reviewClaimedRef.current = true` **before** `await requestReview`; later block / finish / pause / **結束對話** hit `if (reviewClaimedRef.current) return null` | Yes |
| Success keeps the gate | `result` truthy → claim stays; `reviewRef` set; later `ended` does not POST | Yes |

---

## Should-fix (do not produce, do not STOP)

1. **Script: play a different tutor bubble during an ended wait.** `autoReviewWaitRef` stays keyed to the closing `turn.id`. `TutorTurn` 「🔊 唸給我聽」 calls `play(otherTurn)` directly; that idle handler will not match, so auto-review waits until **◼ 停止** / **結束對話**.
2. `small-talk` / `debate` `end_goal` strings are still easy for the model to mark met after a short polite wrap-up (catalog risk, not a field bug).

---

## Checked

| Check | Owner | Result |
|---|---|---|
| Pass-1 failed-review once-gate Must-fix | frontend | PASS — closed (table above) |
| AC4 once-gate in-flight: block / finish / stop / live **暫停** / **結束對話** → one POST | frontend | PASS |
| AC4/AC5 failed review + **結束對話** retry | frontend | PASS |
| AC5 later turn `ended` with `review` already set: no second POST | frontend | PASS |
| AC4 live redirect on review success; stay on fail | frontend | PASS |
| AC1–AC3 catalog / parse / instruction / no extra kind / no 9th scenario | backend | PASS (unchanged this pass) |
| Blank input **400** / unauthenticated **401** / unknown scenario **404** | backend | PASS (unchanged) |
| Keys not in D1 / `api_logs` / SQL / `end_goal` | both | PASS |
| Field names: `end_goal` / `endGoal` / `ended` | both | PASS |

---

## Runnable checklist

Apply local D1 first (once per machine):

```bash
npx wrangler d1 migrations apply fluently_db --local
```

Then:

```bash
npm run build && npm run lint
```

Manual (logged-in, Gemini key set):

1. **Blank input:** client `send("")` no-ops. Direct `POST /api/chat` with empty `text` → **400** `{ "error": "訊息是空的" }`.
2. **Unauthenticated:** `POST /api/chat` and `POST /api/review` without session → **401** `{ "error": "請先登入" }`; no Gemini.
3. **Unknown scenario:** `scenarioId: "nope"` → **404** `{ "error": "找不到這個情境" }`.
4. **Fields:** D1 `end_goal`; TS `endGoal`; chat **200** `ended` boolean. Error bodies have no `ended`. UI never prints `endGoal`.
5. **Parse-fail / not strictly true:** treat as continue; **200** `ended: false`; no `/api/review`.
6. **Goal not met:** partner asks a question; no auto-review.
7. **Goal met, script, auto-speak on:** hear closing (no question) → natural finish → one **正在整理這次練習的回饋…** → in-place 建議 / 單字 / 文法 / 句子. One `kind='review'` row.
8. **Goal met, script, auto-speak off or autoplay blocked:** review starts as soon as the line is on screen; do not wait for **🔊 點一下開啟聲音**.
9. **Goal met, live:** hear closing (or block/stop) → pause / mic close → on review **200/201** land on `/chat/{id}?session={id}&mode=script` with that review. Review fail: stay on live, **回饋沒有產生，請再試一次。**
10. **Once-gate:** during closing TTS, **暫停** then **結束對話** (or stop + **結束對話**) → Network shows **one** `POST /api/review`.
11. **Retry after fail:** force review generate to fail after auto-end; tap **結束對話** again → one new POST; review appears or the same fail copy (not a silent no-op).
12. **Send during wait:** speak another turn before review → previous auto-review cancelled; conversation continues.
13. **Manual 結束對話** still works when the model never sets `ended`. Zero user turns → **至少說一句再結束，才有辦法給回饋。**
14. **Chat Gemini fail:** existing chat error; `api_calls.kind='chat' ok=0`; no auto-review.
15. **Catalog:** still eight public ids; no new `api_calls.kind`.

---

## Handoff

- Goal: Diff review 2 of scenario end-intent after the frontend once-gate retry fix.
- Changes: [`docs/specs/scenario-end-intent-qa.md`](./scenario-end-intent-qa.md) → **PASS**. Must-fix none.
- Next Step: `review_pass: 2`. **PASS**. Do not call `frontend` or `backend` again. Should-fix: do not produce.
