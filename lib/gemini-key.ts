/**
 * Server-only Gemini key resolution. Never import from a Client Component.
 *
 * A leftover key in localStorage is sent as `x-gemini-key` and used to
 * override the env key. That is how "API key not valid" shows up even when
 * `.env.local` / Worker secrets are fine. Chat and speak therefore prefer
 * the server key; `/api/key-check` prefers the header so Settings can
 * still verify a pasted key.
 */

interface GeminiEnv {
  GEMINI_API_KEY?: string;
}

async function getServerGeminiApiKey(): Promise<string | undefined> {
  const fromProcess = process.env.GEMINI_API_KEY?.trim();
  if (fromProcess) return fromProcess;

  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const fromCf = (env as GeminiEnv).GEMINI_API_KEY;
    if (typeof fromCf === "string" && fromCf.trim()) return fromCf.trim();
  } catch {
    // `next build` / routes without a Cloudflare context.
  }

  return undefined;
}

export async function hasServerGeminiKey(): Promise<boolean> {
  return Boolean(await getServerGeminiApiKey());
}

export async function resolveGeminiApiKey(
  request?: Request,
  opts?: { prefer?: "server" | "header" },
): Promise<string | undefined> {
  const header = request?.headers.get("x-gemini-key")?.trim() || undefined;
  const server = await getServerGeminiApiKey();
  if (opts?.prefer === "header") return header || server;
  return server || header;
}
