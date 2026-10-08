import { deleteVoice, getVoice, updateVoice } from "@/lib/db";
import {
  hasOwn,
  jsonError,
  NO_PATCH,
  parseIsFree,
  parseLabel,
  parseVoiceId,
  readJsonObject,
  requireUser,
  VOICE_IN_USE,
  VOICE_NOT_FOUND,
  voiceToJson,
} from "../catalog-http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const voice = await getVoice(id);
  if (!voice) return jsonError(VOICE_NOT_FOUND, 404);
  return Response.json({ voice: voiceToJson(voice) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const parsed = await readJsonObject(request);
  if ("error" in parsed) return parsed.error;

  const hasVoiceId = hasOwn(parsed.body, "voiceId");
  const hasLabel = hasOwn(parsed.body, "label");
  const hasIsFree = hasOwn(parsed.body, "isFree");
  if (!hasVoiceId && !hasLabel && !hasIsFree) {
    return jsonError(NO_PATCH, 400);
  }

  const patch: { voice_id?: string; label?: string; is_free?: 0 | 1 } = {};

  if (hasVoiceId) {
    const voiceId = parseVoiceId(parsed.body.voiceId);
    if (!voiceId.ok) return voiceId.error;
    patch.voice_id = voiceId.value;
  }
  if (hasLabel) {
    const label = parseLabel(parsed.body.label);
    if (!label.ok) return label.error;
    patch.label = label.value;
  }
  if (hasIsFree) {
    const isFree = parseIsFree(parsed.body.isFree);
    if (!isFree.ok) return isFree.error;
    patch.is_free = isFree.value;
  }

  const { id } = await context.params;
  const voice = await updateVoice(id, patch);
  if (!voice) return jsonError(VOICE_NOT_FOUND, 404);
  return Response.json({ voice: voiceToJson(voice) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const result = await deleteVoice(id);
  if (result === "not_found") return jsonError(VOICE_NOT_FOUND, 404);
  if (result === "in_use") return jsonError(VOICE_IN_USE, 409);
  return new Response(null, { status: 204 });
}
