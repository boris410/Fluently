# Spec: \<title\>

- Slug: `\<kebab-case\>`
- Status: draft | qa-spec-pass | implementing | qa-diff-pass
- Source request: \<user's original wording\>

## Background

Why this exists. Who it is for. What is already true in the product (cite DESIGN / SCENARIOS / DATA if relevant).

## User stories

1. As a \<role\>, I want \<capability\> so that \<outcome\>.
2. …

## Acceptance criteria

- [ ] AC1: …
- [ ] AC2: …
- [ ] AC3: …
- [ ] AC4: …
- [ ] AC5: …

Each AC must be observable (UI, API status, or DB row). Include at least one failure path (empty input, unauthenticated, or upstream error).

## Frontend / backend fields

| Field | Source | Type | Notes |
|---|---|---|---|
| … | UI / API / D1 | … | …

## Errors

| Case | User-visible | API / log |
|---|---|---|
| … | … | `ok=0` / status / no secrets |

## Non-goals

What this spec will not do.

## Handoff

- Goal:
- Changes:
- Next Step: QA spec review (`qa` subagent)
