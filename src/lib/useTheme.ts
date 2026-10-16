import { useSyncExternalStore } from "react";
import { readTheme, THEME_CHANGE_EVENT, type Theme } from "./theme";

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
}

/** Aktywny motyw (po stronie serwera zawsze domyślny). */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => "odswiezony");
}
