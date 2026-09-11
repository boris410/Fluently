import {
  countUserMessages,
  deleteSessionReview,
  getHistory,
  getScenario,
  getSession,
  getSessionReview,
  insertSessionReview,
  logApiCall,
  recordCall,
  sessionExists,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { resolveGeminiApiKey } from "@/lib/gemini-key";
import {
  DEFAULT_MODEL,
  GeminiError,
  generateReview,
  parseSessionReview,
} from "@/lib/gemini";

const REVIEW_FAIL = "回饋沒有產生，請再試一次。";

function isUniqueConflict(error: unknown): boolean {
  const parts: string[] = [];
  let current: unknown = error;
  for (let i = 0; i < 4 && current; i++) {
    if (current instanceof Error) {
      parts.push(current.message, current.name);
      current = current.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return parts.some((p) => /UNIQUE constraint failed/i.test(p));
}

async function readValidCachedReview(sessionId: string, userId: string) {
  const existing = await getSessionReview(sessionId, userId);
  if (!existing) return null;
  const review = parseSessionReview(existing.payload);
  if (!review) return null;
  return { review, model: existing.model };
}

/**
 * Out-of-character debrief for one practice session. Lookup order is
 * 400 blank sessionId → 404 not owned → 400 no learner turns → generate.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "請先登入" }, { status: 401 });
  }

  const apiKey = await resolveGeminiApiKey(request);
  if (!apiKey) {
    return Response.json(
      { error: "還沒有 API key。打開右上角設定，貼上你的 Gemini API key。" },
      { status: 401 },
    );
  }

  let body: { sessionId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const sessionId =
    typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId) {
    return Response.json({ error: "缺少 sessionId" }, { status: 400 });
  }

  if (!(await sessionExists(sessionId, user.id))) {
    return Response.json({ error: "找不到這段對話" }, { status: 404 });
  }

  if ((await countUserMessages(sessionId, user.id)) === 0) {
    return Response.json(
      { error: "至少說一句再結束，才有辦法給回饋。" },
      { status: 400 },
    );
  }

  const session = await getSession(sessionId, user.id);
  if (!session) {
    return Response.json({ error: "找不到這段對話" }, { status: 404 });
  }

  const scenario = await getScenario(session.scenario_id);
  if (!scenario) {
    return Response.json({ error: REVIEW_FAIL }, { status: 502 });
  }

  const existing = await readValidCachedReview(sessionId, user.id);
  if (existing) {
    return Response.json(
      {
        cached: true,
        review: existing.review,
        sessionId,
        model: existing.model,
      },
      { status: 200 },
    );
  }
  await deleteSessionReview(sessionId, user.id);

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const turns = (await getHistory(sessionId, user.id)).map((m) => ({
    role: m.role,
    text: m.content,
  }));

  const recordReview = (opts: {
    ok: boolean;
    promptTokens: number;
    outputTokens: number;
    thoughtTokens: number;
    totalTokens: number;
    latencyMs: number;
    error?: string;
  }) =>
    recordCall({
      sessionId,
      kind: "review",
      model,
      promptTokens: opts.promptTokens,
      outputTokens: opts.outputTokens,
      thoughtTokens: opts.thoughtTokens,
      totalTokens: opts.totalTokens,
      latencyMs: opts.latencyMs,
      ok: opts.ok,
      error: opts.error,
    });

  try {
    const result = await generateReview({
      apiKey,
      model,
      scenario,
      turns,
      onCall: (call) => logApiCall({ ...call, sessionId }),
    });

    const payload = JSON.stringify(result.review);
    const usageFields = {
      promptTokens: result.usage.promptTokens,
      outputTokens: result.usage.outputTokens,
      thoughtTokens: result.usage.thoughtTokens,
      totalTokens: result.usage.totalTokens,
      latencyMs: result.latencyMs,
    };

    try {
      await insertSessionReview({
        sessionId,
        userId: user.id,
        payload,
        model,
      });
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;

      const cachedHit = await readValidCachedReview(sessionId, user.id);
      if (cachedHit) {
        await recordReview({ ok: true, ...usageFields });
        return Response.json(
          {
            cached: true,
            review: cachedHit.review,
            sessionId,
            model: cachedHit.model,
          },
          { status: 200 },
        );
      }

      await deleteSessionReview(sessionId, user.id);
      try {
        await insertSessionReview({
          sessionId,
          userId: user.id,
          payload,
          model,
        });
      } catch (retryError) {
        if (!isUniqueConflict(retryError)) throw retryError;
        const raced = await readValidCachedReview(sessionId, user.id);
        if (!raced) throw retryError;
        await recordReview({ ok: true, ...usageFields });
        return Response.json(
          {
            cached: true,
            review: raced.review,
            sessionId,
            model: raced.model,
          },
          { status: 200 },
        );
      }
    }

    await recordReview({ ok: true, ...usageFields });

    return Response.json(
      {
        cached: false,
        review: result.review,
        sessionId,
        usage: result.usage,
        latencyMs: result.latencyMs,
        model,
      },
      { status: 201 },
    );
  } catch (error) {
    const status = error instanceof GeminiError ? error.status : 502;
    const usage = error instanceof GeminiError ? error.usage : null;
    const latencyMs = error instanceof GeminiError ? error.latencyMs : 0;

    await recordReview({
      ok: false,
      promptTokens: usage?.promptTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      thoughtTokens: usage?.thoughtTokens ?? 0,
      totalTokens: usage?.totalTokens ?? 0,
      latencyMs,
      error: REVIEW_FAIL,
    });

    return Response.json({ error: REVIEW_FAIL }, { status });
  }
}
