/**
 * HTTP helpers for /api/runs*. Server-only — imported by route handlers.
 * Pages read snake_case from lib/db.ts and do not use this module.
 */

import type { AgentRunListRow, AgentTurnRow } from "@/lib/db";

export const UNAUTH = { error: "請先登入" };
export const EMPTY_SOURCE = { error: "需求內容是空的" };
export const BAD_JSON = { error: "請求格式錯誤" };
export const BAD_FIELD = { error: "欄位不正確" };
export const BAD_TOKEN = { error: "token 必須是整數或空值" };
export const NOT_FOUND = { error: "找不到這筆執行" };
export const SECRET = { error: "內容含有密鑰，未寫入" };
export const WRITE_FAIL = { error: "寫入失敗" };

const SECRET_PREFIXES = [
  "API_KEY=",
  "CLIENT_SECRET=",
  "BETTER_AUTH_SECRET=",
  "ELEVENLABS_API_KEY=",
] as const;

const ROLES = new Set(["orchestrator", "pm", "qa", "frontend", "backend"]);
const KINDS = new Set(["produce", "review", "fix"]);
const OUTCOMES = new Set(["pass", "must-fix", "stop", "ok", "error"]);
const DIFFICULTY_KINDS = new Set([
  "must-fix",
  "stop-leftover",
  "same-file-conflict",
]);
const PATCH_STATUSES = new Set(["passed", "stopped"]);

const MAX_SOURCE = 4000;
const MAX_TEXT = 4000;
const MAX_SLUG = 128;

export function jsonError(
  body:
    | typeof UNAUTH
    | typeof EMPTY_SOURCE
    | typeof BAD_JSON
    | typeof BAD_FIELD
    | typeof BAD_TOKEN
    | typeof NOT_FOUND
    | typeof SECRET
    | typeof WRITE_FAIL,
  status: number,
) {
  return Response.json(body, { status });
}

export function jsonContainsSecret(value: unknown): boolean {
  if (typeof value === "string") {
    return SECRET_PREFIXES.some((prefix) => value.includes(prefix));
  }
  if (Array.isArray(value)) return value.some(jsonContainsSecret);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(
      jsonContainsSecret,
    );
  }
  return false;
}

export async function readJsonObject(
  request: Request,
  emptyError: typeof BAD_JSON | typeof BAD_FIELD = BAD_JSON,
): Promise<{ body: Record<string, unknown> } | { error: Response }> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { error: jsonError(BAD_JSON, 400) };
  }
  if (!text.trim()) {
    return { error: jsonError(emptyError, 400) };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: jsonError(BAD_JSON, 400) };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: jsonError(BAD_JSON, 400) };
  }
  if (jsonContainsSecret(parsed)) {
    return { error: jsonError(SECRET, 400) };
  }
  return { body: parsed as Record<string, unknown> };
}

export function parseSourceRequest(
  value: unknown,
): { ok: true; value: string } | { ok: false; error: Response } {
  if (value === undefined || value === null) {
    return { ok: false, error: jsonError(EMPTY_SOURCE, 400) };
  }
  if (typeof value !== "string") {
    return { ok: false, error: jsonError(BAD_FIELD, 400) };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: jsonError(EMPTY_SOURCE, 400) };
  }
  return { ok: true, value: trimmed.slice(0, MAX_SOURCE) };
}

export function parseSpecSlug(
  value: unknown,
): { ok: true; value: string | null } | { ok: false; error: Response } {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: jsonError(BAD_FIELD, 400) };
  }
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > MAX_SLUG) {
    return { ok: false, error: jsonError(BAD_FIELD, 400) };
  }
  return { ok: true, value: trimmed };
}

export function parseOptionalText(
  value: unknown,
): { ok: true; value: string | null } | { ok: false; error: Response } {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: jsonError(BAD_FIELD, 400) };
  }
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  return { ok: true, value: trimmed.slice(0, MAX_TEXT) };
}

export function parseOptionalToken(
  value: unknown,
): { ok: true; value: number | null } | { ok: false; error: Response } {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return { ok: false, error: jsonError(BAD_TOKEN, 400) };
  }
  return { ok: true, value };
}

export function parseRole(
  value: unknown,
): { ok: true; value: string } | { ok: false; error: Response } {
  if (typeof value !== "string" || !ROLES.has(value)) {
    return { ok: false, error: jsonError(BAD_FIELD, 400) };
  }
  return { ok: true, value };
}

export function parseKind(
  value: unknown,
): { ok: true; value: string } | { ok: false; error: Response } {
  if (typeof value !== "string" || !KINDS.has(value)) {
    return { ok: false, error: jsonError(BAD_FIELD, 400) };
  }
  return { ok: true, value };
}

export function parseOutcome(
  value: unknown,
): { ok: true; value: string } | { ok: false; error: Response } {
  if (typeof value !== "string" || !OUTCOMES.has(value)) {
    return { ok: false, error: jsonError(BAD_FIELD, 400) };
  }
  return { ok: true, value };
}

export function parseReviewPass(
  value: unknown,
): { ok: true; value: 1 | 2 } | { ok: false; error: Response } {
  if (value !== 1 && value !== 2) {
    return { ok: false, error: jsonError(BAD_FIELD, 400) };
  }
  return { ok: true, value };
}

export function parseDifficultyKind(
  outcome: string,
  value: unknown,
): { ok: true; value: string | null } | { ok: false; error: Response } {
  if (value === undefined || value === null) {
    if (outcome === "must-fix") return { ok: true, value: "must-fix" };
    if (outcome === "stop") return { ok: true, value: "stop-leftover" };
    return { ok: true, value: null };
  }
  if (typeof value !== "string" || !DIFFICULTY_KINDS.has(value)) {
    return { ok: false, error: jsonError(BAD_FIELD, 400) };
  }
  return { ok: true, value };
}

export function parsePatchStatus(
  value: unknown,
): { ok: true; value: "passed" | "stopped" } | { ok: false; error: Response } {
  if (typeof value !== "string" || !PATCH_STATUSES.has(value)) {
    return { ok: false, error: jsonError(BAD_FIELD, 400) };
  }
  return { ok: true, value: value as "passed" | "stopped" };
}

export function runToCamel(row: AgentRunListRow) {
  return {
    id: row.id,
    userId: row.user_id,
    sourceRequest: row.source_request,
    specSlug: row.spec_slug,
    status: row.status,
    latestRole: row.latest_role,
    latestKind: row.latest_kind,
    latestReviewPass: row.latest_review_pass,
    latestOutcome: row.latest_outcome,
    latestNextStep: row.latest_next_step,
    tokensInSum: row.tokens_in_sum,
    tokensOutSum: row.tokens_out_sum,
    turnCount: row.turn_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function turnToCamel(row: AgentTurnRow) {
  return {
    id: row.id,
    runId: row.run_id,
    userId: row.user_id,
    role: row.role,
    kind: row.kind,
    reviewPass: row.review_pass,
    outcome: row.outcome,
    goal: row.goal,
    changes: row.changes,
    nextStep: row.next_step,
    feedback: row.feedback,
    decision: row.decision,
    difficultyKind: row.difficulty_kind,
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
    createdAt: row.created_at,
  };
}

export function writeFailed(error: unknown) {
  console.error("[agent_runs] 寫入失敗：", error);
  return jsonError(WRITE_FAIL, 500);
}
