import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Next treats localhost and 127.0.0.1 as different origins, so HMR
  // websockets from http://127.0.0.1:3000 are blocked unless listed.
  allowedDevOrigins: ["127.0.0.1"],
};

// Exposes the Cloudflare context (env.DB, secrets) to `next dev` so better-auth
// and lib/db.ts can reach the local D1 binding at request time. Without this,
// `getCloudflareContext()` throws under `next dev`.
initOpenNextCloudflareForDev();

export default nextConfig;
