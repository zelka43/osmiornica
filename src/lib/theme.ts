// Wygląd aplikacji wybierany per urządzenie. Brak atrybutu na <html> = Odświeżony.
export type Theme = "odswiezony" | "drogowskaz";

export const THEME_KEY = "dart_theme";
const CHANGE_EVENT = "dart-theme-change";

export const THEME_COLOR: Record<Theme, string> = {
  odswiezony: "#0b0d10",
  drogowskaz: "#f4f4f2",
};

// Wykonywany w <head> przed pierwszym malowaniem — bez mignięcia złego motywu
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="drogowskaz"){document.documentElement.setAttribute("data-theme",t);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","${THEME_COLOR.drogowskaz}")}}catch(e){}`;

export const THEME_CHANGE_EVENT = CHANGE_EVENT;

export function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "drogowskaz"
    ? "drogowskaz"
    : "odswiezony";
}

/** Next może wstawić własny <meta name="theme-color"> po skrypcie startowym — ustawiamy wszystkie */
export function syncThemeColor(theme: Theme = readTheme()) {
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute("content", THEME_COLOR[theme]));
}

export function setTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "drogowskaz") root.setAttribute("data-theme", theme);
  else root.removeAttribute("data-theme");
  syncThemeColor(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
