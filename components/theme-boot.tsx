"use client";

import { useLayoutEffect } from "react";
import { applyTheme, readStoredTheme } from "@/lib/theme";

/**
 * Re-applies the stored theme after React Strict Mode remounts drop `<html>`
 * attributes in dev. Invisible. First paint is handled by the layout script.
 */
export function ThemeBoot() {
  useLayoutEffect(() => {
    applyTheme(readStoredTheme());
  }, []);
  return null;
}
