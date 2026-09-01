export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "fluently-theme";

export const THEMES: { id: Theme; label: string }[] = [
  { id: "light", label: "淺色" },
  { id: "dark", label: "深色" },
  { id: "system", label: "跟隨系統" },
];

/** Mirror of the inline script in `app/layout.tsx` — keep both in sync. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage can throw in private mode — fall through to the default.
  }
  return "system";
}

export function storeTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Preference just won't persist; the current page still switches.
  }
}
