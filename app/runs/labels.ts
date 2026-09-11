/** Labels and formatters for the agent-loop board. Copy matches the spec table. */

export const EM_DASH = "\u2014";

const ROLE_LABEL: Record<string, string> = {
  orchestrator: "編排器",
  pm: "PM",
  qa: "QA",
  frontend: "前端",
  backend: "後端",
};

const KIND_LABEL: Record<string, string> = {
  produce: "產出",
  review: "審查",
  fix: "修復",
};

const OUTCOME_LABEL: Record<string, string> = {
  pass: "通過",
  "must-fix": "必須修正",
  stop: "停止",
  ok: "完成",
  error: "錯誤",
};

const STATUS_LABEL: Record<string, string> = {
  running: "進行中",
  passed: "已完成",
  stopped: "已停止",
};

const DIFFICULTY_LABEL: Record<string, string> = {
  "must-fix": "必須修正",
  "stop-leftover": "停止後剩餘問題",
  "same-file-conflict": "同一檔衝突",
};

export const DIFFICULTY_KINDS = [
  "must-fix",
  "stop-leftover",
  "same-file-conflict",
] as const;

export function roleLabel(role: string | null): string {
  if (!role) return "";
  return ROLE_LABEL[role] ?? role;
}

export function kindLabel(kind: string | null): string {
  if (!kind) return "";
  return KIND_LABEL[kind] ?? kind;
}

export function outcomeLabel(outcome: string | null): string {
  if (!outcome) return "";
  return OUTCOME_LABEL[outcome] ?? outcome;
}

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function difficultyLabel(kind: string | null): string {
  if (!kind) return "";
  return DIFFICULTY_LABEL[kind] ?? kind;
}

export function formatToken(value: number | null): string {
  return value == null ? EM_DASH : value.toLocaleString();
}

export function tokenLine(input: number | null, output: number | null): string {
  return `輸入 ${formatToken(input)} · 輸出 ${formatToken(output)}`;
}

export function stageLine(run: {
  latest_role: string | null;
  latest_kind: string | null;
  latest_review_pass: 1 | 2 | null;
}): string {
  if (run.latest_role == null) return "尚未開始";
  return `${roleLabel(run.latest_role)} · ${kindLabel(run.latest_kind)} · 第 ${run.latest_review_pass} 次`;
}

/** Listed-run token tile: NULL when every side of every row is NULL. */
export function knownTokensTotal(
  runs: { tokens_in_sum: number | null; tokens_out_sum: number | null }[],
): number | null {
  let any = false;
  let sum = 0;
  for (const run of runs) {
    if (run.tokens_in_sum != null) {
      sum += run.tokens_in_sum;
      any = true;
    }
    if (run.tokens_out_sum != null) {
      sum += run.tokens_out_sum;
      any = true;
    }
  }
  return any ? sum : null;
}
