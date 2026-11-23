"use client";

import { useEffect } from "react";
import { CONFIG } from "@/lib/config";
import { useSim } from "@/lib/sim/store";

declare global {
  interface Window {
    /** Debug / presenter handle: window.__kfm.getState(). */
    __kfm?: typeof useSim;
  }
}

/** Starts the simulation once for the whole app and drives the single 2 s tick. */
export function SimRunner() {
  useEffect(() => {
    const { init, tick } = useSim.getState();
    init();
    window.__kfm = useSim;
    const id = setInterval(() => tick(), CONFIG.tickMs);
    // Browsers slow timers in background tabs; catch up the moment the demo is in front again.
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
