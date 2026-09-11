import type { Scenario } from "@/lib/scenarios";

/**
 * Minimal Gemini REST client.
 *
 * Uses `generateContent` (v1beta) rather than the newer Interactions API:
 * Interactions keeps conversation history on Google's side, and this app
 * deliberately keeps its memory in D1.
 * Docs: https://ai.google.dev/api/generate-content
 */

export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * One outbound API call, captured at the boundary. Emitted for every call —
 * success or failure — via the `onCall` option.
 *
 * This module is imported by client components, so it must never touch the
 * database itself. Route handlers pass `onCall: logApiCall` to persist.
 */
export type ApiCallRecord = {
  platform: "gemini";
  endpoint: string;
  operation: "chat" | "tts" | "verify-key" | "review";
  model: string | null;
  detail: string | null;
  input: string | null;
  output: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** HTTP status returned by the provider. */
  status: number;
  ok: boolean;
  error: string | null;
  /** Epoch ms when the request went out and when the response came back. */
  requestedAt: number;
  returnedAt: number;
  durationMs: number;
};

export type ApiCallLogger = (record: ApiCallRecord) => void;

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

/** Canonical post-chat debrief. Same shape in Gemini schema, HTTP `review`, and D1 payload. */
export type AdviceItem = {
  headline: string;
  detail: string;
};

export type VocabItem = {
  word: string;
  meaningZh: string;
  exampleEn: string;
  noteZh: string;
};

export type GrammarItem = {
  pointZh: string;
  issueZh: string;
  betterEn: string;
};

export type SentenceItem = {
  originalEn: string;
  betterEn: string;
  whyZh: string;
};

export type SessionReview = {
  advice: AdviceItem[];
  vocabulary: VocabItem[];
  grammar: GrammarItem[];
  sentences: SentenceItem[];
};

const ADVICE_KEYS = ["headline", "detail"] as const;
const VOCAB_KEYS = ["word", "meaningZh", "exampleEn", "noteZh"] as const;
const GRAMMAR_KEYS = ["pointZh", "issueZh", "betterEn"] as const;
const SENTENCE_KEYS = ["originalEn", "betterEn", "whyZh"] as const;

function asItemStrings<K extends string>(
  item: unknown,
  keys: readonly K[],
): Record<K, string> | null {
  if (!item || typeof item !== "object") return null;
  const rec = item as Record<string, unknown>;
  const out = {} as Record<K, string>;
  for (const key of keys) {
    const value = rec[key];
    if (typeof value !== "string") return null;
    out[key] = value;
  }
  return out;
}

function asItemArray<T>(
  value: unknown,
  parseItem: (item: unknown) => T | null,
): T[] | null {
  if (!Array.isArray(value)) return null;
  const out: T[] = [];
  for (const item of value) {
    const parsed = parseItem(item);
    if (!parsed) return null;
    out.push(parsed);
  }
  return out;
}

/**
 * Validates Canonical JSON. Extra top-level keys are ignored. Missing keys,
 * non-arrays, or items missing a required field → null (malformed).
 * All four arrays empty is valid.
 */
export function parseSessionReview(input: unknown): SessionReview | null {
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const advice = asItemArray(rec.advice, (item) =>
    asItemStrings(item, ADVICE_KEYS),
  );
  const vocabulary = asItemArray(rec.vocabulary, (item) =>
    asItemStrings(item, VOCAB_KEYS),
  );
  const grammar = asItemArray(rec.grammar, (item) =>
    asItemStrings(item, GRAMMAR_KEYS),
  );
  const sentences = asItemArray(rec.sentences, (item) =>
    asItemStrings(item, SENTENCE_KEYS),
  );
  if (!advice || !vocabulary || !grammar || !sentences) return null;
  return { advice, vocabulary, grammar, sentences };
}

const REVIEW_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    advice: {
      type: "ARRAY",
      description: "建議 — 2–4 items when the transcript supports it",
      items: {
        type: "OBJECT",
        properties: {
          headline: {
            type: "STRING",
            description: "繁體中文，短標題",
          },
          detail: {
            type: "STRING",
            description: "繁體中文說明（為何、下次怎麼做）",
          },
        },
        required: ["headline", "detail"],
      },
    },
    vocabulary: {
      type: "ARRAY",
      description: "單字 — 3–6 typical",
      items: {
        type: "OBJECT",
        properties: {
          word: {
            type: "STRING",
            description: "English word or short phrase",
          },
          meaningZh: {
            type: "STRING",
            description: "繁體中文意思",
          },
          exampleEn: {
            type: "STRING",
            description: "English example sentence",
          },
          noteZh: {
            type: "STRING",
            description: "繁體中文：為何點這個字／怎麼用更自然",
          },
        },
        required: ["word", "meaningZh", "exampleEn", "noteZh"],
      },
    },
    grammar: {
      type: "ARRAY",
      description: "文法 — 2–4 typical",
      items: {
        type: "OBJECT",
        properties: {
          pointZh: {
            type: "STRING",
            description: "繁體中文文法點名稱",
          },
          issueZh: {
            type: "STRING",
            description: "繁體中文：這次談話裡發生了什麼",
          },
          betterEn: {
            type: "STRING",
            description: "Corrected / more natural English",
          },
        },
        required: ["pointZh", "issueZh", "betterEn"],
      },
    },
    sentences: {
      type: "ARRAY",
      description: "句子 — 2–4 typical",
      items: {
        type: "OBJECT",
        properties: {
          originalEn: {
            type: "STRING",
            description:
              "Learner sentence (or close paraphrase of what they said)",
          },
          betterEn: {
            type: "STRING",
            description: "More natural English",
          },
          whyZh: {
            type: "STRING",
            description: "繁體中文：為什麼這樣改",
          },
        },
        required: ["originalEn", "betterEn", "whyZh"],
      },
    },
  },
  required: ["advice", "vocabulary", "grammar", "sentences"],
} as const;

function usageFromMeta(meta: {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}): GeminiUsage {
  return {
    promptTokens: meta.promptTokenCount ?? 0,
    outputTokens: meta.candidatesTokenCount ?? 0,
    thoughtTokens: meta.thoughtsTokenCount ?? 0,
    totalTokens: meta.totalTokenCount ?? 0,
  };
}

function formatReviewTranscript(turns: GeminiTurn[]): string {
  return turns
    .map((t) => `${t.role === "user" ? "Learner" : "Tutor"}: ${t.text}`)
    .join("\n");
}

export type ReplyEmotion =
  | "neutral"
  | "thinking"
  | "happy"
  | "encouraging"
  | "surprised"
  | "confused";

const VALID_EMOTIONS: ReplyEmotion[] = [
  "neutral",
  "thinking",
  "happy",
  "encouraging",
  "surprised",
  "confused",
];

export type GeminiResult = {
  text: string;
  emotion: ReplyEmotion;
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
    "- The `reply` field is read aloud by a speech synthesiser, so write plain spoken prose: no markdown, no bullet points, no emoji, no stage directions.",
    "- For `emotion`, pick the single word that best matches the mood of your reply: neutral (default), thinking (pausing to consider), happy (pleased or amused), encouraging (supportive), surprised (unexpected answer), confused (something is unclear).",
  ].join("\n");
}

/** Out-of-character coach prompt. Must not be used for in-scene chat. */
export function buildReviewInstruction(scenario: Scenario): string {
  return [
    "You are an English speaking coach writing a debrief of one practice conversation.",
    "You are not in the scene and must not role-play the conversation partner.",
    `Scene: ${scenario.title} (${scenario.titleZh}). Level: ${scenario.level}. Language focus: ${scenario.focus.join(", ")}.`,
    "Review only this transcript. Be specific to what the learner said.",
    "Return JSON with four arrays: advice, vocabulary, grammar, sentences.",
    "Aim for advice 2–4 items, vocabulary 3–6, grammar 2–4, sentences 2–4 when the transcript supports it. Empty arrays are allowed if a section has nothing useful to mark.",
    "Language:",
    "- headline, detail, meaningZh, noteZh, pointZh, issueZh, whyZh: Traditional Chinese (繁體中文).",
    "- word, exampleEn, betterEn, originalEn: English.",
    "Do not invent a numeric score. Do not stay in character.",
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
  usage: GeminiUsage | null;
  latencyMs: number;

  constructor(
    message: string,
    status: number,
    extra?: { usage?: GeminiUsage | null; latencyMs?: number },
  ) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
    this.usage = extra?.usage ?? null;
    this.latencyMs = extra?.latencyMs ?? 0;
  }
}

export async function generateReply(options: {
  apiKey: string;
  model: string;
  systemInstruction: string;
  turns: GeminiTurn[];
  onCall?: ApiCallLogger;
}): Promise<GeminiResult> {
  const { apiKey, model, systemInstruction, turns, onCall } = options;
  const endpoint = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`;
  const input = turns.at(-1)?.text ?? "";
  const requestedAt = Date.now();

  const res = await fetch(
    endpoint,
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
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 400,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              reply: {
                type: "STRING",
                description: "The English response text from the AI dialogue coach.",
              },
              emotion: {
                type: "STRING",
                enum: VALID_EMOTIONS,
                description:
                  "The emotional state corresponding to the character animation to play.",
              },
            },
            required: ["reply", "emotion"],
          },
        },
      }),
    },
  );

  const returnedAt = Date.now();
  const latencyMs = returnedAt - requestedAt;
  const body = (await res.json().catch(() => null)) as GeminiResponse | null;
  const meta = body?.usageMetadata ?? {};

  const log = (outcome: {
    ok: boolean;
    output: string | null;
    error: string | null;
  }) =>
    onCall?.({
      platform: "gemini",
      endpoint,
      operation: "chat",
      model,
      detail: null,
      input,
      inputTokens: meta.promptTokenCount ?? 0,
      outputTokens: meta.candidatesTokenCount ?? 0,
      totalTokens: meta.totalTokenCount ?? 0,
      status: res.status,
      requestedAt,
      returnedAt,
      durationMs: latencyMs,
      ...outcome,
    });

  if (!res.ok) {
    const message = body?.error?.message ?? `Gemini 回應 ${res.status}`;
    log({ ok: false, output: null, error: message });
    throw new GeminiError(message, res.status);
  }

  const raw =
    body?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? "";

  if (!raw) {
    const message = `模型沒有產生內容（finishReason: ${body?.candidates?.[0]?.finishReason ?? "unknown"}）`;
    log({ ok: false, output: null, error: message });
    throw new GeminiError(message, 502);
  }

  let text = "";
  let emotion: ReplyEmotion = "neutral";
  try {
    const parsed = JSON.parse(raw) as { reply?: string; emotion?: string };
    text = parsed.reply?.trim() ?? "";
    const e = parsed.emotion ?? "";
    emotion = VALID_EMOTIONS.includes(e as ReplyEmotion)
      ? (e as ReplyEmotion)
      : "neutral";
  } catch {
    // Graceful fallback: treat the whole response as the reply text.
    text = raw;
  }

  if (!text) {
    const message = "模型回傳的 JSON 缺少 reply 欄位";
    log({ ok: false, output: raw, error: message });
    throw new GeminiError(message, 502);
  }

  log({ ok: true, output: raw, error: null });

  return {
    text,
    emotion,
    latencyMs,
    usage: {
      promptTokens: meta.promptTokenCount ?? 0,
      outputTokens: meta.candidatesTokenCount ?? 0,
      thoughtTokens: meta.thoughtsTokenCount ?? 0,
      totalTokens: meta.totalTokenCount ?? 0,
    },
  };
}

export type ReviewResult = {
  review: SessionReview;
  usage: GeminiUsage;
  latencyMs: number;
};

export async function generateReview(options: {
  apiKey: string;
  model: string;
  scenario: Scenario;
  turns: GeminiTurn[];
  onCall?: ApiCallLogger;
}): Promise<ReviewResult> {
  const { apiKey, model, scenario, turns, onCall } = options;
  const endpoint = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`;
  const systemInstruction = buildReviewInstruction(scenario);
  const transcript = formatReviewTranscript(turns);
  const requestedAt = Date.now();

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [
          {
            role: "user",
            parts: [{ text: transcript }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
          responseSchema: REVIEW_RESPONSE_SCHEMA,
        },
      }),
    });
  } catch (error) {
    const returnedAt = Date.now();
    const latencyMs = returnedAt - requestedAt;
    const usage = usageFromMeta({});
    onCall?.({
      platform: "gemini",
      endpoint,
      operation: "review",
      model,
      detail: null,
      input: transcript,
      output: null,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      status: 0,
      ok: false,
      error: error instanceof Error ? error.message : "網路錯誤",
      requestedAt,
      returnedAt,
      durationMs: latencyMs,
    });
    throw new GeminiError(
      error instanceof Error ? error.message : "網路錯誤",
      502,
      { usage, latencyMs },
    );
  }

  const returnedAt = Date.now();
  const latencyMs = returnedAt - requestedAt;
  const body = (await res.json().catch(() => null)) as GeminiResponse | null;
  const meta = body?.usageMetadata ?? {};
  const usage = usageFromMeta(meta);

  const log = (outcome: {
    ok: boolean;
    output: string | null;
    error: string | null;
  }) =>
    onCall?.({
      platform: "gemini",
      endpoint,
      operation: "review",
      model,
      detail: null,
      input: transcript,
      inputTokens: usage.promptTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      status: res.status,
      requestedAt,
      returnedAt,
      durationMs: latencyMs,
      ...outcome,
    });

  if (!res.ok) {
    const message = body?.error?.message ?? `Gemini 回應 ${res.status}`;
    log({ ok: false, output: null, error: message });
    throw new GeminiError(message, res.status, { usage, latencyMs });
  }

  const raw =
    body?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? "";

  if (!raw) {
    const message = `模型沒有產生內容（finishReason: ${body?.candidates?.[0]?.finishReason ?? "unknown"}）`;
    log({ ok: false, output: null, error: message });
    throw new GeminiError(message, 502, { usage, latencyMs });
  }

  const review = parseSessionReview(raw);
  if (!review) {
    const message = "模型回傳的 JSON 無法解析為回饋";
    log({ ok: false, output: raw, error: message });
    throw new GeminiError(message, 502, { usage, latencyMs });
  }

  log({ ok: true, output: raw, error: null });

  return { review, usage, latencyMs };
}

/** Validates a key without spending tokens — just lists available models. */
export async function verifyKey(apiKey: string, onCall?: ApiCallLogger) {
  const endpoint = `${GEMINI_BASE}/models?pageSize=1`;
  const requestedAt = Date.now();
  const res = await fetch(endpoint, {
    headers: { "x-goog-api-key": apiKey },
  });
  const returnedAt = Date.now();

  const body = res.ok
    ? null
    : ((await res.json().catch(() => null)) as GeminiResponse | null);
  const message = res.ok
    ? null
    : (body?.error?.message ?? `HTTP ${res.status}`);

  onCall?.({
    platform: "gemini",
    endpoint,
    operation: "verify-key",
    model: null,
    detail: null,
    input: null,
    output: res.ok ? "key 有效" : null,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    status: res.status,
    ok: res.ok,
    error: message,
    requestedAt,
    returnedAt,
    durationMs: returnedAt - requestedAt,
  });

  if (res.ok) return { ok: true as const };
  return { ok: false as const, status: res.status, message: message! };
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
  onCall?: ApiCallLogger;
}): Promise<{ wav: Uint8Array; usage: GeminiUsage; latencyMs: number }> {
  const { apiKey, model, voice, text, onCall } = options;
  const endpoint = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`;
  const requestedAt = Date.now();

  const res = await fetch(
    endpoint,
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

  const returnedAt = Date.now();
  const latencyMs = returnedAt - requestedAt;
  const body = (await res.json().catch(() => null)) as TtsResponse | null;
  const meta = body?.usageMetadata ?? {};

  const log = (outcome: {
    ok: boolean;
    output: string | null;
    error: string | null;
  }) =>
    onCall?.({
      platform: "gemini",
      endpoint,
      operation: "tts",
      model,
      detail: `voice=${voice}`,
      input: text,
      inputTokens: meta.promptTokenCount ?? 0,
      outputTokens: meta.candidatesTokenCount ?? 0,
      totalTokens: meta.totalTokenCount ?? 0,
      status: res.status,
      requestedAt,
      returnedAt,
      durationMs: latencyMs,
      ...outcome,
    });

  if (!res.ok) {
    const message = body?.error?.message ?? `語音合成回應 ${res.status}`;
    log({ ok: false, output: null, error: message });
    throw new GeminiError(message, res.status);
  }

  const inline = body?.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.data,
  )?.inlineData;

  if (!inline?.data) {
    log({ ok: false, output: null, error: "模型沒有回傳音訊" });
    throw new GeminiError("模型沒有回傳音訊", 502);
  }

  const pcm = Uint8Array.from(Buffer.from(inline.data, "base64"));
  const rate = sampleRateFrom(inline.mimeType);
  const seconds = pcm.length / (rate * 2);

  log({
    ok: true,
    output: `[audio] ${rate}Hz 16-bit mono · ${seconds.toFixed(1)}s · ${pcm.length} bytes`,
    error: null,
  });

  return {
    wav: pcmToWav(pcm, rate),
    latencyMs,
    usage: {
      promptTokens: meta.promptTokenCount ?? 0,
      outputTokens: meta.candidatesTokenCount ?? 0,
      thoughtTokens: 0,
      totalTokens: meta.totalTokenCount ?? 0,
    },
  };
}
