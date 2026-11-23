// Light is the default (CLAUDE.md §4). The choice is remembered per device.
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "kfm-theme";

/** Runs before first paint (inlined in <head>) so dark mode never flashes light. */
export const THEME_BOOT_SCRIPT = `(function(){try{if(localStorage.getItem('${THEME_STORAGE_KEY}')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})();`;

export function readTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Fired on window whenever the theme changes, so every toggle button stays in step. */
export const THEME_EVENT = "kfm-theme-change";

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.dispatchEvent(new Event(THEME_EVENT));
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode / blocked storage: the toggle still works for this visit.
  }
}
