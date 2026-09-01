import type { Scenario } from "@/lib/scenarios";

/**
 * Minimal Gemini REST client.
 *
 * Uses `generateContent` (v1beta) rather than the newer Interactions API:
 * Interactions keeps conversation history on Google's side, and this app
 * deliberately keeps its memory in local SQLite.
 * Docs: https://ai.google.dev/api/generate-content
 */

export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const DEFAULT_MODEL = "gemini-3.5-flash-lite";

export const MODELS: { id: string; label: string; note: string }[] = [
  { id: "gemini-3.7-flash", label: "3.7 Flash", note: "預設，速度與品質平衡" },
  { id: "gemini-3.5-flash-lite", label: "3.5 Flash Lite", note: "最省、最快" },
  { id: "gemini-2.5-flash", label: "2.5 Flash", note: "較舊的穩定選擇" },
];

export type GeminiTurn = { role: "user" | "model"; text: string };

export type GeminiUsage = {
  promptTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  totalTokens: number;
};

export type GeminiResult = {
  text: string;
  usage: GeminiUsage;
  latencyMs: number;
};

const LEVEL_GUIDANCE: Record<Scenario["level"], string> = {
  beginner:
    "The learner is a beginner. Use short, simple sentences (roughly A2 level), common words, and one question at a time.",
  intermediate:
    "The learner is intermediate (B1-B2). Use natural everyday English, and occasionally introduce a slightly less common phrase.",
  advanced:
    "The learner is advanced (B2-C1). Speak at a natural native pace with idiomatic phrasing, and push back when their reasoning is thin.",
};

/** Builds the tutor's system instruction from a scenario definition. */
export function buildSystemInstruction(scenario: Scenario): string {
  return [
    `You are an English conversation partner in a speaking-practice app. In this session you play ${scenario.persona}.`,
    `Scene: ${scenario.title}. ${scenario.blurb}`,
    LEVEL_GUIDANCE[scenario.level],
    `Steer the conversation so the learner naturally practises: ${scenario.focus.join(", ")}.`,
    "Rules:",
    "- Stay in character. Never mention that you are an AI, a model, or a language tutor.",
    "- Reply with 1-3 sentences, then ask one question that keeps the conversation going.",
    "- Reply in English only, even if the learner writes in another language.",
    "- If the learner makes a mistake that would confuse a real listener, model the correct phrasing naturally in your reply instead of correcting them like a teacher.",
    "- Never break the scene to give a grammar lesson, a score, or a summary.",
    "- Your reply is read aloud by a speech synthesiser, so write plain spoken prose: no markdown, no bullet points, no emoji, no stage directions.",
  ].join("\n");
}

type GeminiResponse = {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message?: string; status?: string };
};

export class GeminiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
  }
}

export async function generateReply(options: {
  apiKey: string;
  model: string;
  systemInstruction: string;
  turns: GeminiTurn[];
}): Promise<GeminiResult> {
  const { apiKey, model, systemInstruction, turns } = options;
  const started = Date.now();

  const res = await fetch(
    `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: turns.map((t) => ({
          role: t.role,
          parts: [{ text: t.text }],
        })),
        generationConfig: { temperature: 0.9, maxOutputTokens: 400 },
      }),
    },
  );

  const latencyMs = Date.now() - started;
  const body = (await res.json().catch(() => null)) as GeminiResponse | null;

  if (!res.ok) {
    throw new GeminiError(
      body?.error?.message ?? `Gemini 回應 ${res.status}`,
      res.status,
    );
  }

  const text =
    body?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? "";

  if (!text) {
    throw new GeminiError(
      `模型沒有產生內容（finishReason: ${body?.candidates?.[0]?.finishReason ?? "unknown"}）`,
      502,
    );
  }

  const meta = body?.usageMetadata ?? {};
  return {
    text,
    latencyMs,
    usage: {
      promptTokens: meta.promptTokenCount ?? 0,
      outputTokens: meta.candidatesTokenCount ?? 0,
      thoughtTokens: meta.thoughtsTokenCount ?? 0,
      totalTokens: meta.totalTokenCount ?? 0,
    },
  };
}

/** Validates a key without spending tokens — just lists available models. */
export async function verifyKey(apiKey: string) {
  const res = await fetch(`${GEMINI_BASE}/models?pageSize=1`, {
    headers: { "x-goog-api-key": apiKey },
  });
  if (res.ok) return { ok: true as const };
  const body = (await res.json().catch(() => null)) as GeminiResponse | null;
  return {
    ok: false as const,
    status: res.status,
    message: body?.error?.message ?? `HTTP ${res.status}`,
  };
}

// --- Text to speech -----------------------------------------------------

/**
 * TTS also goes through `generateContent` rather than the Interactions API:
 * this path documents `usageMetadata` for audio, which the usage page needs.
 * Docs: https://ai.google.dev/gemini-api/docs/generate-content/speech-generation
 */

export const DEFAULT_TTS_MODEL = "gemini-3.1-flash-tts-preview";

export const TTS_MODELS = [
  "gemini-3.1-flash-tts-preview",
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-pro-preview-tts",
] as const;

/** The 30 prebuilt voices, with their documented style. */
export const VOICES: { id: string; style: string }[] = [
  { id: "Sulafat", style: "溫暖" },
  { id: "Achird", style: "親切" },
  { id: "Aoede", style: "輕鬆" },
  { id: "Vindemiatrix", style: "溫和" },
  { id: "Callirrhoe", style: "隨和" },
  { id: "Umbriel", style: "隨和" },
  { id: "Zubenelgenubi", style: "隨性" },
  { id: "Leda", style: "年輕" },
  { id: "Puck", style: "輕快" },
  { id: "Laomedeia", style: "輕快" },
  { id: "Sadachbia", style: "活潑" },
  { id: "Zephyr", style: "明亮" },
  { id: "Autonoe", style: "明亮" },
  { id: "Erinome", style: "清晰" },
  { id: "Iapetus", style: "清晰" },
  { id: "Algieba", style: "圓潤" },
  { id: "Despina", style: "圓潤" },
  { id: "Achernar", style: "柔和" },
  { id: "Schedar", style: "平穩" },
  { id: "Charon", style: "沉穩" },
  { id: "Rasalgethi", style: "沉穩" },
  { id: "Sadaltager", style: "博學" },
  { id: "Kore", style: "堅定" },
  { id: "Orus", style: "堅定" },
  { id: "Alnilam", style: "堅定" },
  { id: "Gacrux", style: "成熟" },
  { id: "Pulcherrima", style: "積極" },
  { id: "Fenrir", style: "熱切" },
  { id: "Enceladus", style: "氣音" },
  { id: "Algenib", style: "沙啞" },
];

export const DEFAULT_VOICE = "Sulafat";

export const isKnownVoice = (name: string) =>
  VOICES.some((v) => v.id === name);

type TtsResponse = {
  candidates?: {
    content?: {
      parts?: { inlineData?: { data?: string; mimeType?: string } }[];
    };
  }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message?: string };
};

/** Wraps raw little-endian PCM in a 44-byte RIFF header so browsers can play it. */
export function pcmToWav(
  pcm: Uint8Array,
  sampleRate: number,
  channels = 1,
  bitsPerSample = 16,
): Uint8Array {
  const blockAlign = (channels * bitsPerSample) / 8;
  const out = new Uint8Array(44 + pcm.length);
  const view = new DataView(out.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  ascii(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // format: PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  ascii(36, "data");
  view.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
}

/** Gemini returns e.g. `audio/L16;codec=pcm;rate=24000`. Default to 24 kHz. */
function sampleRateFrom(mimeType: string | undefined) {
  const match = mimeType?.match(/rate=(\d+)/);
  return match ? Number(match[1]) : 24000;
}

export async function synthesizeSpeech(options: {
  apiKey: string;
  model: string;
  voice: string;
  text: string;
}): Promise<{ wav: Uint8Array; usage: GeminiUsage; latencyMs: number }> {
  const { apiKey, model, voice, text } = options;
  const started = Date.now();

  const res = await fetch(
    `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
          },
        },
      }),
    },
  );

  const latencyMs = Date.now() - started;
  const body = (await res.json().catch(() => null)) as TtsResponse | null;

  if (!res.ok) {
    throw new GeminiError(
      body?.error?.message ?? `語音合成回應 ${res.status}`,
      res.status,
    );
  }

  const inline = body?.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.data,
  )?.inlineData;

  if (!inline?.data) {
    throw new GeminiError("模型沒有回傳音訊", 502);
  }

  const pcm = Uint8Array.from(Buffer.from(inline.data, "base64"));
  const meta = body?.usageMetadata ?? {};

  return {
    wav: pcmToWav(pcm, sampleRateFrom(inline.mimeType)),
    latencyMs,
    usage: {
      promptTokens: meta.promptTokenCount ?? 0,
      outputTokens: meta.candidatesTokenCount ?? 0,
      thoughtTokens: 0,
      totalTokens: meta.totalTokenCount ?? 0,
    },
  };
}
