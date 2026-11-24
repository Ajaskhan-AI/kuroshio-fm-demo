"use client";

import { useEffect } from "react";
import { CONFIG } from "@/lib/config";
import { useCold } from "@/lib/ksense/store";
import { usePulse } from "@/lib/kpulse/store";
import { useSim } from "@/lib/sim/store";

declare global {
  interface Window {
    /** Debug / presenter handle: window.__kfm.getState(). */
    __kfm?: typeof useSim;
    __ksense?: typeof useCold;
    __kpulse?: typeof usePulse;
  }
}

/** Starts the simulation once for the whole app and drives the single 2 s tick. */
export function SimRunner() {
  useEffect(() => {
    const { init, tick } = useSim.getState();
    const cold = useCold.getState();
    init();
    cold.init();
    usePulse.getState().init();
    window.__kfm = useSim;
    window.__ksense = useCold;
    window.__kpulse = usePulse;
    const tickAll = () => {
      tick();
      useCold.getState().tick();
      usePulse.getState().tick();
    };
    const id = setInterval(tickAll, CONFIG.tickMs);
    // Browsers slow timers in background tabs; catch up the moment the demo is in front again.
    const onVisible = () => {
      if (document.visibilityState === "visible") tickAll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
