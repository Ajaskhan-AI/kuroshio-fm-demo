"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { MonitorPlay } from "lucide-react";
import { INCIDENT } from "@/lib/sim/scenario";
import { useSim } from "@/lib/sim/store";
import { useUiStore } from "@/lib/ui-store";

export const START_TOUR_EVENT = "kfm-start-tour";

const IDLE_MS = 60_000;
const STEP_MS = 12_000;
const KIOSK_KEY = "kfm-kiosk";

// The story order (CLAUDE.md §9): by the time each screen comes up, the incident has reached it.
const TOUR = [
  "/",
  `/buildings/${INCIDENT.buildingId}/smdb?panel=SMDB-04`,
  `/buildings/${INCIDENT.buildingId}/bms`,
  `/buildings/${INCIDENT.buildingId}/energy`,
  "/alarms",
  `/maintenance?asset=${encodeURIComponent(INCIDENT.pumpId)}`,
  "/reports",
  "/roi",
];

function kioskEnabled(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get("kiosk");
    if (q === "1") sessionStorage.setItem(KIOSK_KEY, "1");
    if (q === "0") sessionStorage.removeItem(KIOSK_KEY);
    return sessionStorage.getItem(KIOSK_KEY) === "1";
  } catch {
    return new URLSearchParams(window.location.search).get("kiosk") === "1";
  }
}

/**
 * Kiosk mode (CLAUDE.md §9): with ?kiosk=1, after 60 s with no input the app tours every screen
 * every 12 s with the incident running, replaying the incident each lap. Any tap, click, key or
 * scroll stops the tour; the idle clock then starts again. The presenter panel can start it too.
 */
export function Kiosk() {
  const router = useRouter();
  const touring = useUiStore((s) => s.touring);
  const enabled = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stepTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    enabled.current = kioskEnabled();

    const stopTour = () => {
      if (stepTimer.current) clearInterval(stepTimer.current);
      stepTimer.current = undefined;
      if (useUiStore.getState().touring) useUiStore.setState({ touring: false });
    };

    const startTour = () => {
      stopTour();
      let i = 0;
      const lap = () => {
        // Fresh portfolio and a fresh incident each lap, so the story always plays from the start.
        useSim.getState().reset();
        useSim.getState().triggerIncident();
        useUiStore.setState({ buildingId: INCIDENT.buildingId, touring: true, presenterOpen: false });
      };
      lap();
      router.push(TOUR[0]);
      stepTimer.current = setInterval(() => {
        i = (i + 1) % TOUR.length;
        if (i === 0) lap();
        router.push(TOUR[i]);
      }, STEP_MS);
    };

    const armIdle = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (enabled.current) idleTimer.current = setTimeout(startTour, IDLE_MS);
    };

    const onInput = () => {
      stopTour();
      armIdle();
    };

    const onStart = () => {
      enabled.current = true;
      try {
        sessionStorage.setItem(KIOSK_KEY, "1");
      } catch {
        // Fine: kiosk stays on for this page view.
      }
      // Ignore the tap that pressed the button.
      setTimeout(startTour, 50);
    };

    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, onInput, { passive: true }));
    window.addEventListener(START_TOUR_EVENT, onStart);
    armIdle();

    return () => {
      events.forEach((e) => window.removeEventListener(e, onInput));
      window.removeEventListener(START_TOUR_EVENT, onStart);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      stopTour();
    };
  }, [router]);

  if (!touring) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4">
      <p className="inline-flex items-center gap-2 rounded-full bg-foreground/85 px-4 py-2 text-sm font-medium text-background shadow-lg">
        <MonitorPlay className="size-4" aria-hidden /> Auto tour · tap anywhere to explore
      </p>
    </div>
  );
}
