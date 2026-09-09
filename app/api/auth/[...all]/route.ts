import { getAuth } from "@/lib/auth";

/**
 * better-auth's catch-all handler (sign-in, callback, session, sign-out…).
 * The instance is built per request so it can reach the D1 binding.
 */
export async function GET(request: Request) {
  return (await getAuth()).handler(request);
}

export async function POST(request: Request) {
  return (await getAuth()).handler(request);
}
