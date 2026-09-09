import { betterAuth, type BetterAuthOptions } from "better-auth";

/**
 * better-auth server instance. Server-only — never import from a Client
 * Component.
 *
 * The instance is created lazily (`getAuth()`) because it needs the D1 binding,
 * which only exists at request time on Workers. `initOpenNextCloudflareForDev()`
 * in next.config.ts makes `getCloudflareContext({ async: true })` resolve under
 * `next dev` too, so dev and prod share the same code path (local miniflare D1).
 *
 * Pass the raw D1 binding as `database`. better-auth detects `prepare`+`batch`+
 * `exec` and uses its built-in D1 dialect with transactions off (D1 does not
 * support interactive transactions). Schema is owned by wrangler migrations
 * (`0003_auth.sql`), not better-auth's CLI.
 */

/** Enough of D1 for better-auth's dialect detection + the user_students hook. */
interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      all(): Promise<unknown>;
    };
  };
  batch(statements: unknown[]): Promise<unknown>;
  exec(query: string): Promise<unknown>;
}

interface AppEnv {
  DB?: D1Like;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

type Auth = ReturnType<typeof betterAuth>;

const globalForAuth = globalThis as unknown as {
  __fluentlyAuth?: Auth;
  __fluentlyAuthKey?: string;
};

function envValue(env: AppEnv, key: keyof AppEnv): string | undefined {
  // Prefer process.env so `next dev` picks up `.env.local` reloads.
  // Miniflare only reads `.dev.vars` when the server starts.
  const fromProcess = process.env[key as string]?.trim();
  if (fromProcess) return fromProcess;
  const fromCf = env[key];
  if (typeof fromCf === "string" && fromCf.trim()) return fromCf.trim();
  return undefined;
}

export async function getAuth(): Promise<Auth> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const { env } = await getCloudflareContext({ async: true });
  const appEnv = env as unknown as AppEnv;
  const d1 = appEnv.DB;

  if (!d1?.prepare || !d1.batch || !d1.exec) {
    throw new Error(
      "D1 binding `DB` is missing (or is not a real D1Database). better-auth needs prepare/batch/exec.",
    );
  }

  const secret = envValue(appEnv, "BETTER_AUTH_SECRET");
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is missing — cannot start better-auth.");
  }

  const baseURL =
    envValue(appEnv, "BETTER_AUTH_URL") ?? "http://localhost:3000";
  const googleClientId = envValue(appEnv, "GOOGLE_CLIENT_ID") ?? "";
  const googleClientSecret = envValue(appEnv, "GOOGLE_CLIENT_SECRET") ?? "";
  const cacheKey = `${secret}|${baseURL}|${googleClientId}|${googleClientSecret}`;

  if (
    globalForAuth.__fluentlyAuth &&
    globalForAuth.__fluentlyAuthKey === cacheKey
  ) {
    return globalForAuth.__fluentlyAuth;
  }

  if (!googleClientId || !googleClientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET is missing — cannot start Google sign-in.",
    );
  }

  const options: BetterAuthOptions = {
    database: d1,
    secret,
    baseURL,
    trustedOrigins: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://fluently.persional-etutor.workers.dev",
      baseURL,
    ],
    advanced: {
      database: {
        // Schema is applied by wrangler migrations, not better-auth.
        validateSchema: false,
      },
    },
    socialProviders: {
      google: {
        clientId: googleClientId,
        clientSecret: googleClientSecret,
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            try {
              const now = Date.now();
              await d1
                .prepare(
                  `INSERT INTO user_students (id, name, created_at, updated_at)
                   VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
                )
                .bind(user.id, user.name ?? user.email ?? "Learner", now, now)
                .run();
            } catch (error) {
              console.error("[auth] user_students 建立失敗：", error);
            }
          },
        },
      },
    },
  };

  const auth = betterAuth(options);
  globalForAuth.__fluentlyAuth = auth;
  globalForAuth.__fluentlyAuthKey = cacheKey;
  return auth;
}
