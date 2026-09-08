import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Default OpenNext Cloudflare setup. Caching backends (KV/R2) can be added
// here later; the app currently relies only on the D1 binding (env.DB).
export default defineCloudflareConfig();
