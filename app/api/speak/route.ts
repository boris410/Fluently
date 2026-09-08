import {
  appendMessage,
  createSession,
  getScenario,
  logApiCall,
  recordCall,
  sessionExists,
} from "@/lib/db";
import {
  DEFAULT_TTS_MODEL,
  DEFAULT_VOICE,
  GeminiError,
  isKnownVoice,
  synthesizeSpeech,
} from "@/lib/gemini";

/**
 * Turns one tutor line into audio with a Gemini TTS voice, and books the
 * audio tokens against the session so /usage sees the real cost of speech.
 * Returns WAV bytes; metadata rides along in headers.
 */
export async function POST(request: Request) {
  const apiKey =
    request.headers.get("x-gemini-key")?.trim() ||
    process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return Response.json({ error: "還沒有 API key" }, { status: 401 });
  }

  let body: {
    text?: string;
    voice?: string;
    scenarioId?: string;
    sessionId?: string;
    mode?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const text = body.text?.trim();
  const scenario = body.scenarioId
    ? await getScenario(body.scenarioId)
    : undefined;

  if (!text) return Response.json({ error: "沒有要唸的內容" }, { status: 400 });
  if (!scenario) {
    return Response.json({ error: "找不到這個情境" }, { status: 404 });
  }

  const voice =
    body.voice && isKnownVoice(body.voice) ? body.voice : DEFAULT_VOICE;
  const model = process.env.GEMINI_TTS_MODEL?.trim() || DEFAULT_TTS_MODEL;

  // Audio has to be booked against a session, so start one if the learner
  // has not spoken yet (replaying the opening line before their first turn).
  let sessionId = body.sessionId;
  if (!sessionId || !(await sessionExists(sessionId))) {
    sessionId = await createSession(
      scenario.id,
      body.mode === "live" ? "live" : "script",
    );
    await appendMessage(sessionId, "model", scenario.opening);
  }

  try {
    const result = await synthesizeSpeech({
      apiKey,
      model,
      voice,
      text,
      onCall: (call) => logApiCall({ ...call, sessionId }),
    });

    await recordCall({
      sessionId,
      kind: "tts",
      model,
      promptTokens: result.usage.promptTokens,
      outputTokens: result.usage.outputTokens,
      thoughtTokens: 0,
      totalTokens: result.usage.totalTokens,
      latencyMs: result.latencyMs,
      ok: true,
    });

    return new Response(result.wav as BodyInit, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
        "x-session-id": sessionId,
        "x-voice": voice,
        "x-tokens": String(result.usage.totalTokens),
        "x-latency": String(result.latencyMs),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "語音合成失敗";
    const status = error instanceof GeminiError ? error.status : 500;

    await recordCall({
      sessionId,
      kind: "tts",
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
