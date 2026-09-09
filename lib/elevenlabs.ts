/**
 * ElevenLabs TTS client.
 *
 * Same logging contract as gemini.ts: emit `onCall` and never import
 * the database layer. The API key is passed in — this file never reads env.
 */

export const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

/** Low-latency flash model from the original test snippet. */
export const DEFAULT_ELEVENLABS_MODEL = "eleven_flash_v2_5";

export const ELEVENLABS_MODELS: { id: string; label: string }[] = [
  { id: "eleven_flash_v2_5", label: "Flash v2.5（低延遲）" },
  { id: "eleven_multilingual_v2", label: "Multilingual v2" },
];

export type ElevenLabsCallRecord = {
  platform: "elevenlabs";
  endpoint: string;
  operation: "tts";
  model: string | null;
  detail: string | null;
  input: string | null;
  output: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  status: number;
  ok: boolean;
  error: string | null;
  requestedAt: number;
  returnedAt: number;
  durationMs: number;
};

export type ElevenLabsCallLogger = (record: ElevenLabsCallRecord) => void;

export class ElevenLabsError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ElevenLabsError";
    this.status = status;
  }
}

type ElevenLabsErrorBody = {
  detail?: string | { status?: string; message?: string };
};

function errorMessage(body: ElevenLabsErrorBody | null, status: number) {
  const detail = body?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (detail && typeof detail === "object") {
    return detail.message?.trim() || detail.status || `ElevenLabs 回應 ${status}`;
  }
  return `ElevenLabs 回應 ${status}`;
}

export async function synthesizeElevenLabs(options: {
  apiKey: string;
  voiceId: string;
  text: string;
  model?: string;
  onCall?: ElevenLabsCallLogger;
}): Promise<{ audio: ArrayBuffer; contentType: string; latencyMs: number }> {
  const {
    apiKey,
    voiceId,
    text,
    model = DEFAULT_ELEVENLABS_MODEL,
    onCall,
  } = options;
  const endpoint = `${ELEVENLABS_BASE}/text-to-speech/${encodeURIComponent(voiceId)}`;
  const requestedAt = Date.now();

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  const returnedAt = Date.now();
  const latencyMs = returnedAt - requestedAt;

  const log = (outcome: {
    ok: boolean;
    output: string | null;
    error: string | null;
  }) =>
    onCall?.({
      platform: "elevenlabs",
      endpoint,
      operation: "tts",
      model,
      detail: `voice=${voiceId}`,
      input: text,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      status: res.status,
      requestedAt,
      returnedAt,
      durationMs: latencyMs,
      ok: outcome.ok,
      output: outcome.output,
      error: outcome.error,
    });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ElevenLabsErrorBody | null;
    const message = errorMessage(body, res.status);
    log({ ok: false, output: null, error: message });
    throw new ElevenLabsError(message, res.status);
  }

  const audio = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") || "audio/mpeg";
  log({
    ok: true,
    output: `[audio] mpeg ${(audio.byteLength / 1024).toFixed(1)}KB`,
    error: null,
  });

  return { audio, contentType, latencyMs };
}
