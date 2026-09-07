import {
  appendMessage,
  createSession,
  logApiCall,
  recordCall,
  sessionExists,
} from "@/lib/db";
import {
  DEFAULT_ELEVENLABS_MODEL,
  ELEVENLABS_MODELS,
  ElevenLabsError,
  readElevenLabsVoiceId,
  synthesizeElevenLabs,
} from "@/lib/elevenlabs";
import { getScenario } from "@/lib/scenarios";

function userFacingError(message: string, status: number) {
  if (
    status === 402 ||
    /library voices/i.test(message) ||
    /upgrade your subscription/i.test(message)
  ) {
    return "這個音色在 Voice Library 裡，免費方案不能用 API 合成。請升級 ElevenLabs，或改用帳號裡的 Premade / Cloned 聲音。";
  }
  return message;
}

/**
 * Server-side proxy for ElevenLabs TTS.
 * The key stays in `.env.local` and never reaches the browser.
 * With a scenarioId (conversation), audio is booked against a session.
 * Without one (the /tts test page), only api_logs is written.
 */
export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();

  if (!apiKey) {
    return Response.json(
      { error: "還沒有 ElevenLabs API key。在 .env.local 設 ELEVENLABS_API_KEY。" },
      { status: 401 },
    );
  }

  let body: {
    text?: string;
    model?: string;
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
  if (!text) {
    return Response.json({ error: "沒有要唸的內容" }, { status: 400 });
  }

  const voiceId = readElevenLabsVoiceId();
  if (!voiceId) {
    return Response.json(
      { error: "還沒有音色。在 .env.local 設 ELEVENLABS_VOICE_ID。" },
      { status: 400 },
    );
  }

  const knownModel = ELEVENLABS_MODELS.some((m) => m.id === body.model);
  const model = knownModel
    ? body.model!
    : process.env.ELEVENLABS_MODEL?.trim() || DEFAULT_ELEVENLABS_MODEL;

  const scenario = body.scenarioId ? getScenario(body.scenarioId) : undefined;
  let sessionId = body.sessionId ?? null;
  if (scenario) {
    if (!sessionId || !sessionExists(sessionId)) {
      sessionId = createSession(
        scenario.id,
        body.mode === "live" ? "live" : "script",
      );
      appendMessage(sessionId, "model", scenario.opening);
    }
  }

  try {
    const result = await synthesizeElevenLabs({
      apiKey,
      voiceId,
      text,
      model,
      onCall: (call) => logApiCall({ ...call, sessionId }),
    });

    if (scenario && sessionId) {
      recordCall({
        sessionId,
        scenarioId: scenario.id,
        kind: "tts",
        model,
        voice: voiceId,
        promptTokens: 0,
        outputTokens: 0,
        thoughtTokens: 0,
        totalTokens: 0,
        latencyMs: result.latencyMs,
        ok: true,
      });
    }

    return new Response(result.audio, {
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "no-store",
        ...(sessionId ? { "x-session-id": sessionId } : {}),
        "x-voice": voiceId,
        "x-model": model,
        "x-latency": String(result.latencyMs),
      },
    });
  } catch (error) {
    const raw =
      error instanceof Error ? error.message : "語音合成失敗";
    const status = error instanceof ElevenLabsError ? error.status : 500;
    const message = userFacingError(raw, status);

    if (scenario && sessionId) {
      recordCall({
        sessionId,
        scenarioId: scenario.id,
        kind: "tts",
        model,
        voice: voiceId,
        promptTokens: 0,
        outputTokens: 0,
        thoughtTokens: 0,
        totalTokens: 0,
        latencyMs: 0,
        ok: false,
        error: message,
      });
    }

    return Response.json(
      { error: message, ...(sessionId ? { sessionId } : {}) },
      { status },
    );
  }
}
