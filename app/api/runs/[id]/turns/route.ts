import { appendAgentTurn } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import {
  jsonError,
  NOT_FOUND,
  parseDifficultyKind,
  parseKind,
  parseOptionalText,
  parseOptionalToken,
  parseOutcome,
  parseReviewPass,
  parseRole,
  readJsonObject,
  turnToCamel,
  UNAUTH,
  writeFailed,
} from "@/lib/agent-run-http";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return jsonError(UNAUTH, 401);

  const parsed = await readJsonObject(request);
  if ("error" in parsed) return parsed.error;

  const role = parseRole(parsed.body.role);
  if (!role.ok) return role.error;
  const kind = parseKind(parsed.body.kind);
  if (!kind.ok) return kind.error;
  const reviewPass = parseReviewPass(parsed.body.reviewPass);
  if (!reviewPass.ok) return reviewPass.error;
  const outcome = parseOutcome(parsed.body.outcome);
  if (!outcome.ok) return outcome.error;

  const goal = parseOptionalText(parsed.body.goal);
  if (!goal.ok) return goal.error;
  const changes = parseOptionalText(parsed.body.changes);
  if (!changes.ok) return changes.error;
  const nextStep = parseOptionalText(parsed.body.nextStep);
  if (!nextStep.ok) return nextStep.error;
  const feedback = parseOptionalText(parsed.body.feedback);
  if (!feedback.ok) return feedback.error;
  const decision = parseOptionalText(parsed.body.decision);
  if (!decision.ok) return decision.error;

  const difficultyKind = parseDifficultyKind(
    outcome.value,
    parsed.body.difficultyKind,
  );
  if (!difficultyKind.ok) return difficultyKind.error;

  const tokensIn = parseOptionalToken(parsed.body.tokensIn);
  if (!tokensIn.ok) return tokensIn.error;
  const tokensOut = parseOptionalToken(parsed.body.tokensOut);
  if (!tokensOut.ok) return tokensOut.error;

  try {
    const { id } = await context.params;
    const turn = await appendAgentTurn(user.id, id, {
      role: role.value,
      kind: kind.value,
      reviewPass: reviewPass.value,
      outcome: outcome.value,
      goal: goal.value,
      changes: changes.value,
      nextStep: nextStep.value,
      feedback: feedback.value,
      decision: decision.value,
      difficultyKind: difficultyKind.value,
      tokensIn: tokensIn.value,
      tokensOut: tokensOut.value,
    });
    if (!turn) return jsonError(NOT_FOUND, 404);
    return Response.json({ turn: turnToCamel(turn) }, { status: 201 });
  } catch (error) {
    return writeFailed(error);
  }
}
