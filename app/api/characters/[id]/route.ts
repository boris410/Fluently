import { getCharacter, getVoice, updateCharacterVoice } from "@/lib/db";
import {
  CHARACTER_NOT_FOUND,
  characterToJson,
  jsonError,
  parseCharacterVoiceId,
  readJsonObject,
  requireUser,
  VOICE_NOT_FOUND,
} from "../../voices/catalog-http";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const parsed = await readJsonObject(request);
  if ("error" in parsed) return parsed.error;

  const voiceId = parseCharacterVoiceId(parsed.body.elevenlabsVoiceId);
  if (!voiceId.ok) return voiceId.error;

  const { id } = await context.params;
  const character = await getCharacter(id);
  if (!character) return jsonError(CHARACTER_NOT_FOUND, 404);

  const voice = await getVoice(voiceId.value);
  if (!voice) return jsonError(VOICE_NOT_FOUND, 400);

  const updated = await updateCharacterVoice(id, voiceId.value);
  if (!updated) return jsonError(CHARACTER_NOT_FOUND, 404);
  return Response.json({ character: characterToJson(updated) });
}
