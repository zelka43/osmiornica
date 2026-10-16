"use client";

import { useEffect } from "react";
import { syncThemeColor } from "@/lib/theme";

/** Po hydracji wyrównuje kolor paska statusu z aktywnym motywem. */
export default function ThemeSync() {
  useEffect(() => {
    syncThemeColor();
  }, []);
  return null;
}
