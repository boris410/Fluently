import { logApiCall } from "@/lib/db";
import { hasServerGeminiKey, resolveGeminiApiKey } from "@/lib/gemini-key";
import { verifyKey } from "@/lib/gemini";

/** Whether the server already has a Gemini key (env / Worker secret). */
export async function GET() {
  return Response.json({ configured: await hasServerGeminiKey() });
}

/** Validates an API key by listing models — costs no tokens. */
export async function POST(request: Request) {
  const apiKey = await resolveGeminiApiKey(request, { prefer: "header" });

  if (!apiKey) {
    return Response.json({ ok: false, message: "沒有提供 key" }, { status: 400 });
  }

  const result = await verifyKey(apiKey, logApiCall);
  return Response.json(result, { status: result.ok ? 200 : 200 });
}
