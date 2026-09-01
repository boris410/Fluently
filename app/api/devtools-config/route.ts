import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Dev-only: exposes the Next.js DevTools config file so the settings menu
 * can show the indicator's current position and size. Writing goes
 * straight to Next's own `/__nextjs_devtools_config` endpoint instead.
 */
const CANDIDATE_PATHS = [
  join(process.cwd(), ".next", "dev", "cache", "next-devtools-config.json"),
  join(process.cwd(), ".next", "cache", "next-devtools-config.json"),
];

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }

  for (const path of CANDIDATE_PATHS) {
    try {
      const raw = await readFile(path, "utf8");
      return Response.json(JSON.parse(raw));
    } catch {
      // Try the next location.
    }
  }

  return Response.json({});
}
