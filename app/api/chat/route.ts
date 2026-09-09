import {
  appendMessage,
  createSession,
  getHistory,
  getScenario,
  logApiCall,
  recordCall,
  sessionExists,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import {
  DEFAULT_MODEL,
  GeminiError,
  buildSystemInstruction,
  generateReply,
} from "@/lib/gemini";

/**
 * One conversational turn: persist what the learner said, ask Gemini for
 * the reply, persist that too, and record the token cost of the round trip.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "請先登入" }, { status: 401 });
  }

  const apiKey =
    request.headers.get("x-gemini-key")?.trim() ||
    process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return Response.json(
      { error: "還沒有 API key。打開右上角設定，貼上你的 Gemini API key。" },
      { status: 401 },
    );
  }

  let body: {
    scenarioId?: string;
    sessionId?: string;
    text?: string;
    mode?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const scenario = body.scenarioId
    ? await getScenario(body.scenarioId)
    : undefined;
  const text = body.text?.trim();

  if (!scenario) {
    return Response.json({ error: "找不到這個情境" }, { status: 404 });
  }
  if (!text) {
    return Response.json({ error: "訊息是空的" }, { status: 400 });
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  // Resume the session when the client already has one, otherwise start a
  // new one seeded with the scenario's opening line so the model sees it.
  let sessionId = body.sessionId;
  if (!sessionId || !(await sessionExists(sessionId, user.id))) {
    sessionId = await createSession(
      scenario.id,
      body.mode === "live" ? "live" : "script",
      user.id,
    );
    await appendMessage(sessionId, "model", scenario.opening);
  }

  await appendMessage(sessionId, "user", text);

  const turns = (await getHistory(sessionId, user.id)).map((m) => ({
    role: m.role,
    text: m.content,
  }));

  try {
    const result = await generateReply({
      apiKey,
      model,
      systemInstruction: buildSystemInstruction(scenario),
      turns,
      onCall: (call) => logApiCall({ ...call, sessionId }),
    });

    await appendMessage(sessionId, "model", result.text);
    await recordCall({
      sessionId,
      kind: "chat",
      model,
      promptTokens: result.usage.promptTokens,
      outputTokens: result.usage.outputTokens,
      thoughtTokens: result.usage.thoughtTokens,
      totalTokens: result.usage.totalTokens,
      latencyMs: result.latencyMs,
      ok: true,
    });

    return Response.json({
      sessionId,
      reply: result.text,
      emotion: result.emotion,
      usage: result.usage,
      latencyMs: result.latencyMs,
      model,
    });
  } catch (error) {
    const message =
      error instanceof GeminiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "未知錯誤";
    const status = error instanceof GeminiError ? error.status : 500;

    // Failed round trips are still round trips — record them so the usage
    // page shows the real error rate.
    await recordCall({
      sessionId,
      kind: "chat",
      model,
      promptTokens: 0,
      outputTokens: 0,
      thoughtTokens: 0,
      totalTokens: 0,
      latencyMs: 0,
      ok: false,
      error: message,
    });

    return Response.json({ error: message, sessionId }, { status });
  }
}
