import { getAgentRun, patchAgentRun } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import {
  BAD_FIELD,
  jsonError,
  NOT_FOUND,
  parsePatchStatus,
  parseSpecSlug,
  readJsonObject,
  runToCamel,
  turnToCamel,
  UNAUTH,
  writeFailed,
} from "@/lib/agent-run-http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return jsonError(UNAUTH, 401);

  const { id } = await context.params;
  const found = await getAgentRun(user.id, id);
  if (!found) return jsonError(NOT_FOUND, 404);

  return Response.json({
    run: runToCamel(found.run),
    turns: found.turns.map(turnToCamel),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return jsonError(UNAUTH, 401);

  const parsed = await readJsonObject(request, BAD_FIELD);
  if ("error" in parsed) return parsed.error;

  const hasStatus = Object.prototype.hasOwnProperty.call(
    parsed.body,
    "status",
  );
  const hasSlug = Object.prototype.hasOwnProperty.call(
    parsed.body,
    "specSlug",
  );
  if (!hasStatus && !hasSlug) return jsonError(BAD_FIELD, 400);

  const patch: { status?: "passed" | "stopped"; specSlug?: string | null } =
    {};

  if (hasStatus) {
    const status = parsePatchStatus(parsed.body.status);
    if (!status.ok) return status.error;
    patch.status = status.value;
  }
  if (hasSlug) {
    const slug = parseSpecSlug(parsed.body.specSlug);
    if (!slug.ok) return slug.error;
    patch.specSlug = slug.value;
  }

  try {
    const { id } = await context.params;
    const run = await patchAgentRun(user.id, id, patch);
    if (!run) return jsonError(NOT_FOUND, 404);
    return Response.json({ run: runToCamel(run) });
  } catch (error) {
    return writeFailed(error);
  }
}
