"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Browser-side auth client. baseURL is left unset so it targets the current
 * origin's `/api/auth/*`, which works for both localhost and the Workers domain.
 */
export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
