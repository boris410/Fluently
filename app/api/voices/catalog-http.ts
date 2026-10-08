import { getCurrentUser } from "@/lib/current-user";
import type { CharacterRow, VoiceRow } from "@/lib/db";

export const UNAUTH = { error: "請先登入" };
export const BAD_JSON = { error: "請求格式錯誤" };
export const EMPTY_ID = { error: "內部代號不能空白" };
export const BAD_ID = { error: "內部代號必須是小寫英文、數字與連字號" };
export const DUP_ID = { error: "這個內部代號已經存在" };
export const EMPTY_VOICE_ID = { error: "ElevenLabs 音色代號不能空白" };
export const EMPTY_LABEL = { error: "名稱不能空白" };
export const BAD_IS_FREE = { error: "免費標記無效" };
export const NO_PATCH = { error: "沒有要更新的欄位" };
export const VOICE_NOT_FOUND = { error: "找不到這顆音色" };
export const VOICE_IN_USE = { error: "還有人物在用這顆音色，請先改指派再刪" };
export const CHARACTER_NOT_FOUND = { error: "找不到這個人物" };
export const CHARACTER_NEEDS_VOICE = { error: "人物必須指定一顆音色" };

const INTERNAL_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export type VoiceJSON = {
  id: string;
  voiceId: string;
  label: string;
  isFree: boolean;
};

export type CharacterJSON = {
  id: string;
  name: string;
  elevenlabsVoiceId: string;
};

export function jsonError(
  body: { error: string },
  status: number,
): Response {
  return Response.json(body, { status });
}

export async function requireUser(): Promise<
  { user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>> } | { error: Response }
> {
  const user = await getCurrentUser();
  if (!user) return { error: jsonError(UNAUTH, 401) };
  return { user };
}

export async function readJsonObject(
  request: Request,
): Promise<{ body: Record<string, unknown> } | { error: Response }> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return { error: jsonError(BAD_JSON, 400) };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: jsonError(BAD_JSON, 400) };
  }
  return { body: parsed as Record<string, unknown> };
}

export function voiceToJson(row: VoiceRow): VoiceJSON {
  return {
    id: row.id,
    voiceId: row.voice_id,
    label: row.label,
    isFree: row.is_free === 1,
  };
}

export function characterToJson(row: CharacterRow): CharacterJSON {
  return {
    id: row.id,
    name: row.name,
    elevenlabsVoiceId: row.elevenlabs_voice_id,
  };
}

export function parseInternalId(
  value: unknown,
): { ok: true; value: string } | { ok: false; error: Response } {
  if (value === undefined || value === null) {
    return { ok: false, error: jsonError(EMPTY_ID, 400) };
  }
  if (typeof value !== "string") {
    return { ok: false, error: jsonError(BAD_ID, 400) };
  }
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: jsonError(EMPTY_ID, 400) };
  if (trimmed.length > 64 || !INTERNAL_ID.test(trimmed)) {
    return { ok: false, error: jsonError(BAD_ID, 400) };
  }
  return { ok: true, value: trimmed };
}

export function parseVoiceId(
  value: unknown,
): { ok: true; value: string } | { ok: false; error: Response } {
  if (typeof value !== "string") {
    return { ok: false, error: jsonError(EMPTY_VOICE_ID, 400) };
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 128) {
    return { ok: false, error: jsonError(EMPTY_VOICE_ID, 400) };
  }
  return { ok: true, value: trimmed };
}

export function parseLabel(
  value: unknown,
): { ok: true; value: string } | { ok: false; error: Response } {
  if (typeof value !== "string") {
    return { ok: false, error: jsonError(EMPTY_LABEL, 400) };
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80) {
    return { ok: false, error: jsonError(EMPTY_LABEL, 400) };
  }
  return { ok: true, value: trimmed };
}

export function parseIsFree(
  value: unknown,
): { ok: true; value: 0 | 1 } | { ok: false; error: Response } {
  if (value === true) return { ok: true, value: 1 };
  if (value === false) return { ok: true, value: 0 };
  return { ok: false, error: jsonError(BAD_IS_FREE, 400) };
}

export function parseCharacterVoiceId(
  value: unknown,
): { ok: true; value: string } | { ok: false; error: Response } {
  if (value === undefined || value === null || typeof value !== "string") {
    return { ok: false, error: jsonError(CHARACTER_NEEDS_VOICE, 400) };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: jsonError(CHARACTER_NEEDS_VOICE, 400) };
  }
  return { ok: true, value: trimmed };
}

export function hasOwn(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}
