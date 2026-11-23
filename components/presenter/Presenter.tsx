"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Flame, Keyboard, MonitorPlay, Moon, RotateCcw, Snowflake } from "lucide-react";
import { NAV_ITEMS, buildingIdForPath } from "@/lib/nav";
import { useCold } from "@/lib/ksense/store";
import { INCIDENT } from "@/lib/sim/scenario";
import { useSim } from "@/lib/sim/store";
import { applyTheme, readTheme } from "@/lib/theme";
import { useUiStore } from "@/lib/ui-store";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { START_TOUR_EVENT } from "./Kiosk";

/** Shared presenter actions, used by the keyboard and by the panel's touch buttons. */
export function usePresenterActions() {
  const router = useRouter();
  const pathname = usePathname();
  const setBuildingId = useUiStore((s) => s.setBuildingId);

  const startIncident = useCallback(() => {
    useSim.getState().triggerIncident();
    setBuildingId(INCIDENT.buildingId);
    // On another building's screen, follow the incident to Marina Tower A.
    const current = buildingIdForPath(pathname);
    if (current && current !== INCIDENT.buildingId) router.push(pathname.replace(`/buildings/${current}`, `/buildings/${INCIDENT.buildingId}`));
  }, [pathname, router, setBuildingId]);

  const startColdIncident = useCallback(() => {
    useCold.getState().triggerIncident();
    if (pathname !== "/ksense") router.push("/ksense");
  }, [pathname, router]);

  const reset = useCallback(() => {
    useSim.getState().reset();
    useCold.getState().reset();
  }, []);
  const toggleDark = useCallback(() => applyTheme(readTheme() === "dark" ? "light" : "dark"), []);
  const goTo = useCallback(
    (index: number) => {
      const item = NAV_ITEMS[index];
      if (item) router.push(item.href(useUiStore.getState().buildingId));
    },
    [router],
  );
  return { startIncident, startColdIncident, reset, toggleDark, goTo };
}

const KEYS: [string, string][] = [
  ["1 – 9", "Jump to a screen (same order as the menu)"],
  ["I", "Start the Marina Tower A incident"],
  ["K", "Start the K-Sense cold-chain incident"],
  ["R", "Reset the simulation"],
  ["D", "Dark mode on / off"],
  ["?", "Show or hide this panel"],
];

function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/** Presenter mode (CLAUDE.md §9): keyboard shortcuts plus a panel with the same actions for touch screens. */
export function Presenter() {
  const open = useUiStore((s) => s.presenterOpen);
  const setOpen = useUiStore((s) => s.setPresenterOpen);
  const incident = useSim((s) => s.incident);
  const coldIncident = useCold((s) => s.incident);
  const { startIncident, startColdIncident, reset, toggleDark, goTo } = usePresenterActions();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const k = e.key;
      if (k >= "1" && k <= "9") goTo(Number(k) - 1);
      else if (k === "i" || k === "I") startIncident();
      else if (k === "k" || k === "K") startColdIncident();
      else if (k === "r" || k === "R") reset();
      else if (k === "d" || k === "D") toggleDark();
      else if (k === "?") setOpen(!useUiStore.getState().presenterOpen);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, startIncident, startColdIncident, reset, toggleDark, setOpen]);

  const btn = "inline-flex min-h-11 w-full items-center gap-3 rounded-lg border border-border bg-card px-4 text-left text-sm font-semibold hover:border-primary/50";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Presenter</SheetTitle>
          <SheetDescription>Run the demo story. The same actions work from the keyboard.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4">
          <button
            type="button"
            className={`${btn} border-danger/40`}
            onClick={() => {
              startIncident();
              setOpen(false);
            }}
          >
            <Flame className="size-5 text-danger" aria-hidden />
            <span className="flex-1">{incident ? "Restart the incident" : "Start the incident"}</span>
            <kbd className="text-xs text-muted-foreground">I</kbd>
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => {
              startColdIncident();
              setOpen(false);
            }}
          >
            <Snowflake className="size-5 text-primary" aria-hidden />
            <span className="flex-1">{coldIncident ? "Restart the cold-chain incident" : "Start the cold-chain incident"}</span>
            <kbd className="text-xs text-muted-foreground">K</kbd>
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => {
              reset();
              setOpen(false);
            }}
          >
            <RotateCcw className="size-5 text-primary" aria-hidden />
            <span className="flex-1">Reset the simulation</span>
            <kbd className="text-xs text-muted-foreground">R</kbd>
          </button>
          <button type="button" className={btn} onClick={toggleDark}>
            <Moon className="size-5 text-primary" aria-hidden />
            <span className="flex-1">Dark mode on / off</span>
            <kbd className="text-xs text-muted-foreground">D</kbd>
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new Event(START_TOUR_EVENT));
            }}
          >
            <MonitorPlay className="size-5 text-primary" aria-hidden />
            <span className="flex-1">Start the auto tour (kiosk)</span>
          </button>

          <p className="mt-2 text-xs text-muted-foreground">
            The incident on Marina Tower A: SMDB-04 heats from 41 to 63 °C over 40 s, AHU-3 runs while the BMS says off, and CHW Pump-2 health falls to
            58. Alarms, work orders, the BMS cross-check, energy waste and the monthly report all pick it up.
          </p>
          <p className="text-xs text-muted-foreground">
            The cold-chain incident (K-Sense): the Jebel Ali FR-02 dock door is left open and the freezer climbs from −21 to −12 °C, then recovers and
            lands in the excursion log. At the same time KIZAD PH-02 suction pressure falls: a refrigerant leak caught while the room is still in range.
          </p>

          <h3 className="mt-4 flex items-center gap-2 text-sm font-semibold">
            <Keyboard className="size-4" aria-hidden /> Keys
          </h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            {KEYS.map(([k, what]) => (
              <div key={k} className="contents">
                <dt>
                  <kbd className="inline-flex min-w-9 justify-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold">{k}</kbd>
                </dt>
                <dd className="text-muted-foreground">{what}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">
            Kiosk: open the site with <code className="rounded bg-muted px-1">?kiosk=1</code>. After 60 s without a touch it tours the screens every 12 s
            with the incident running. Any tap hands control back.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
