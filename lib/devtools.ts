/**
 * Thin client for the Next.js DevTools dev-server endpoints.
 *
 * Everything here is development-only: the endpoints are middleware
 * registered by `next dev` and do not exist in a production build.
 * Verified against `node_modules/next/dist/next-devtools/server/`.
 */

export const IS_DEV = process.env.NODE_ENV === "development";

export type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export const CORNERS: { id: Corner; label: string }[] = [
  { id: "top-left", label: "左上" },
  { id: "top-right", label: "右上" },
  { id: "bottom-left", label: "左下" },
  { id: "bottom-right", label: "右下" },
];

/**
 * The overlay renders at `36 / scale` px, so a larger scale means a
 * smaller badge. Values copied from `NEXT_DEV_TOOLS_SCALE`.
 */
export const SCALES: { id: string; label: string; value: number }[] = [
  { id: "small", label: "小", value: 16 / 14 },
  { id: "medium", label: "中", value: 1 },
  { id: "large", label: "大", value: 16 / 18 },
];

export const scaleIdFor = (value: number | undefined) =>
  SCALES.find((s) => Math.abs(s.value - (value ?? 1)) < 0.001)?.id ?? "medium";

export type DevToolsConfig = {
  theme?: "light" | "dark" | "system";
  devToolsPosition?: Corner;
  scale?: number;
  disableDevIndicator?: boolean;
};

/** Reads the config file through our own dev-only route handler. */
export async function fetchDevToolsConfig(): Promise<DevToolsConfig | null> {
  if (!IS_DEV) return null;
  try {
    const res = await fetch("/api/devtools-config", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as DevToolsConfig;
  } catch {
    return null;
  }
}

/**
 * Patches `.next/dev/cache/next-devtools-config.json`. The dev server
 * deep-merges the patch and pushes it to the overlay over HMR, so the
 * change is live — no reload needed.
 */
export async function patchDevToolsConfig(patch: DevToolsConfig) {
  if (!IS_DEV) return false;
  try {
    const res = await fetch("/__nextjs_devtools_config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Hides the floating indicator for 24 hours. This flag lives only in the
 * dev server's memory (`devIndicatorServerState.disabledUntil`), so there
 * is no endpoint to undo it — restarting `next dev` brings it back.
 */
export async function hideDevIndicator() {
  if (!IS_DEV) return false;
  try {
    const res = await fetch("/__nextjs_disable_dev_indicator", {
      method: "POST",
    });
    return res.ok;
  } catch {
    return false;
  }
}
