import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

/**
 * Server helper: resolves the logged-in user from the request cookies, or
 * `null` when there's no valid session. Use in API routes and server
 * components to gate and to scope data by `user.id`.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return null;
    const { id, name, email, image } = session.user;
    return { id, name, email, image: image ?? null };
  } catch (error) {
    console.error("[auth] getSession 失敗：", error);
    return null;
  }
}
