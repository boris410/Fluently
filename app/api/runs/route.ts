import { createAgentRun, listAgentRuns } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import {
  jsonError,
  parseSourceRequest,
  parseSpecSlug,
  readJsonObject,
  runToCamel,
  UNAUTH,
  writeFailed,
} from "@/lib/agent-run-http";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError(UNAUTH, 401);

  const rows = await listAgentRuns(user.id);
  return Response.json({ runs: rows.map(runToCamel) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError(UNAUTH, 401);

  const parsed = await readJsonObject(request);
  if ("error" in parsed) return parsed.error;

  const source = parseSourceRequest(parsed.body.sourceRequest);
  if (!source.ok) return source.error;

  const slug = parseSpecSlug(parsed.body.specSlug);
  if (!slug.ok) return slug.error;

  try {
    const run = await createAgentRun(user.id, source.value, slug.value);
    return Response.json({ run: runToCamel(run) }, { status: 201 });
  } catch (error) {
    return writeFailed(error);
  }
}
