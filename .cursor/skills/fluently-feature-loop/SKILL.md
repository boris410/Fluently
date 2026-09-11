---
name: fluently-feature-loop
description: Runs Fluently's PM → QA spec review → frontend/backend → QA diff loop by delegating to project subagents. Use when the user states a product feature, 需求, 實作, or asks to add/change app behavior. Do not use for questions-only, OAuth/secret setup, or a single-file fix the user already specified.
---

# Fluently feature loop

You are the orchestrator. The user only states a requirement. You launch subagents. Do not ask them to open four Agent tabs.

## Do not start

Skip this loop when the message is only a question, plan feedback, Google Console / `wrangler secret` setup, or a one-file change with the file and edit already named.

## Retry cap (hard)

Each role gets **one** fix after a failed review. The **second** review that still has Must-fix **stops that role**. No third produce, no third review, no extra "just one more".

Count **per role** (`pm`, `frontend`, `backend`). QA does not patch product code.

| Pass | What happens |
|---|---|
| Produce 1 | Role writes first draft |
| Review 1 | QA. PASS → continue. Must-fix → that role fixes **once** |
| Produce 2 | The one allowed fix |
| Review 2 | QA again. PASS → continue. Any remaining Must-fix → **STOP that role**, list leftovers for the user |

Should-fix never starts a fix round and never blocks STOP. A role that crashes or returns empty on Produce 1 may retry that produce once; a second crash stops that role.

If **PM** hits STOP, do not start frontend/backend. If only frontend or only backend hits STOP, finish the other role's remaining allowed pass, then stop the loop and report both.

## Loop

Use Task. Set `subagent_type` to `pm`, `qa`, `frontend`, or `backend` (project agents in `.cursor/agents/`). If those types are missing from the catalog, use `generalPurpose` and paste the matching `.cursor/agents/*.md` body into the prompt. Give each subagent the user requirement, spec path, review pass number (`1` or `2`), and any prior Goal / Changes / Next Step.

1. **PM** produce 1 — `docs/specs/<slug>.md` from `docs/specs/_template.md`.
2. **QA spec** review 1 — PASS → step 3. Must-fix → PM produce 2, then QA spec review 2. Review 2 still Must-fix → STOP (no implementation).
3. **Frontend + backend** produce 1 in parallel — same spec, strict file ownership (`AGENTS.md`). One message, two Task calls. Same-file conflict → sequential, then say so.
4. **QA diff** review 1 — per-role findings. Must-fix for a role → that role produce 2 only. Then QA diff review 2 for the roles that fixed. Review 2 still Must-fix → STOP those roles.
5. **You** — One summary: spec path, changes, which roles PASSed or STOPped, leftover Must-fix, anything the human must do. Do not commit unless asked.

## Board log (required)

Persist the loop to D1 so `/runs` stays in sync. Use the logged-in owner session (dev `http://localhost:3000` cookie). Never put `.env` values, `API_KEY=`, or Client Secrets in any field. If tokens are unknown, send JSON `null` for `tokensIn` / `tokensOut` — never estimate.

1. At loop start: `POST /api/runs` with `{ "sourceRequest": "<user wording>" }`. Keep `id`. After PM produce, `PATCH /api/runs/:id` with `{ "specSlug": "<slug>" }`.
2. After **each** subagent: `POST /api/runs/:id/turns` with required `role`, `kind` (`produce` | `review` | `fix`), `reviewPass` (`1` | `2`), `outcome`, plus Goal / Changes / Next Step as `goal` / `changes` / `nextStep`. Optional `feedback`, `decision`, `difficultyKind`, tokens.
3. `difficultyKind`: `must-fix` (QA Must-fix), `stop-leftover` (retry-cap STOP leftovers), `same-file-conflict` (orchestrator tuple: `role=orchestrator`, `kind=produce`, `outcome=ok`, current `reviewPass`).
4. When the loop ends: `PATCH /api/runs/:id` `{ "status": "passed" }` or `{ "status": "stopped" }`.
5. If POST fails (401 / 400), tell the user the board was not updated; do not retry with secrets stripped into the body.

## Constraints

- Specs live in `docs/specs/`. Never copy `.env.local` / `.dev.vars` into specs, rules, or commits.
- `npx wrangler secret put` and Google Cloud Console stay human.
- Subagent replies must include Goal / Changes / Next Step.
