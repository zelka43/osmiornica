import { useEffect } from "react";

/** Nie pozwala wygasić ekranu, dopóki `active` (np. w trakcie meczu). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    const request = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        sentinel = await navigator.wakeLock.request("screen");
        if (released) void sentinel.release();
      } catch {
        // Odmowa (np. tryb oszczędzania baterii) — trudno, ekran może zgasnąć
      }
    };

    // Blokada znika przy schowaniu karty — odnawiamy po powrocie
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };

    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release();
    };
  }, [active]);
}
