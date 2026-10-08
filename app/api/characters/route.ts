import { listCharacters } from "@/lib/db";
import { characterToJson, requireUser } from "../voices/catalog-http";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const characters = await listCharacters();
  return Response.json({ characters: characters.map(characterToJson) });
}
