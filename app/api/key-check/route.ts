import { logApiCall } from "@/lib/db";
import { verifyKey } from "@/lib/gemini";

/** Validates an API key by listing models — costs no tokens. */
export async function POST(request: Request) {
  const apiKey =
    request.headers.get("x-gemini-key")?.trim() ||
    process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return Response.json({ ok: false, message: "沒有提供 key" }, { status: 400 });
  }

  const result = await verifyKey(apiKey, logApiCall);
  return Response.json(result, { status: result.ok ? 200 : 200 });
}
