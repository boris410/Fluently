import { DuplicateVoiceIdError, insertVoice, listVoices } from "@/lib/db";
import {
  DUP_ID,
  EMPTY_LABEL,
  EMPTY_VOICE_ID,
  hasOwn,
  jsonError,
  parseInternalId,
  parseIsFree,
  parseLabel,
  parseVoiceId,
  readJsonObject,
  requireUser,
  voiceToJson,
} from "./catalog-http";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const voices = await listVoices();
  return Response.json({ voices: voices.map(voiceToJson) });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const parsed = await readJsonObject(request);
  if ("error" in parsed) return parsed.error;

  const id = parseInternalId(parsed.body.id);
  if (!id.ok) return id.error;

  if (!hasOwn(parsed.body, "voiceId")) {
    return jsonError(EMPTY_VOICE_ID, 400);
  }
  const voiceId = parseVoiceId(parsed.body.voiceId);
  if (!voiceId.ok) return voiceId.error;

  if (!hasOwn(parsed.body, "label")) {
    return jsonError(EMPTY_LABEL, 400);
  }
  const label = parseLabel(parsed.body.label);
  if (!label.ok) return label.error;

  let isFree: 0 | 1 = 0;
  if (hasOwn(parsed.body, "isFree")) {
    const parsedFree = parseIsFree(parsed.body.isFree);
    if (!parsedFree.ok) return parsedFree.error;
    isFree = parsedFree.value;
  }

  try {
    const voice = await insertVoice({
      id: id.value,
      voice_id: voiceId.value,
      label: label.value,
      is_free: isFree,
    });
    return Response.json({ voice: voiceToJson(voice) }, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateVoiceIdError) {
      return jsonError(DUP_ID, 409);
    }
    throw error;
  }
}
