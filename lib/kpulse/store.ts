"use client";

// K-Pulse simulation store. Ticked by the same SimRunner as the FM simulation and reset with it.
// Observations live here; work orders go into the shared FM work-order list so the Alarms screen,
// SLA tracking and the technician flow pick them up.

import { create } from "zustand";
import { useSim } from "../sim/store";
import type { Trade } from "../types";
import { EMPTY_PULSE, advancePulse, createPulseState, isObsOpen, type PulseData } from "./engine";
import { PULSE_INCIDENT } from "./scenario";
import type { Observation } from "./types";

interface PulseActions {
  init: () => void;
  tick: (now?: number) => void;
  reset: () => void;
  /** Start (or restart) the scripted CHW-P4 trip + CHW-P3 cavitation incident. */
  triggerIncident: () => void;
  acknowledge: (obsId: string) => void;
  /** Raise a work order for an observation (once). Returns the work-order id. */
  createWorkOrder: (obsId: string) => string | undefined;
}

export type PulseStore = PulseData & PulseActions;

const tradeFor = (o: Observation): Trade => (o.kind === "electrical" || o.kind === "stopped" ? "Electrical" : "Mechanical");

function raiseWorkOrder(s: PulseData, o: Observation): string | undefined {
  const sim = useSim.getState();
  if (!sim.ready) return undefined;
  const a = s.assets[o.assetId];
  return sim.createWorkOrder({ buildingId: o.buildingId, priority: o.priority, title: `${a?.tag ?? ""} ${o.title.toLowerCase()} (K-Pulse)`.trim(), trade: tradeFor(o) });
}

export const usePulse = create<PulseStore>()((set, get) => ({
  ...EMPTY_PULSE,

  init: () => {
    if (get().ready) return;
    set(createPulseState(Date.now()));
  },

  tick: (now = Date.now()) => {
    const s = get();
    if (!s.ready) return;
    const next = advancePulse(s, now);
    // New P1/P2 observations open a work order straight away, like the FM alarms do.
    const before = new Set(s.observations.map((o) => o.id));
    const observations = next.observations.map((o) => {
      if (before.has(o.id) || o.priority === "P3" || o.workOrderId) return o;
      const wo = raiseWorkOrder(next, o);
      return wo ? { ...o, workOrderId: wo } : o;
    });
    set({ ...next, observations });
  },

  reset: () => set(createPulseState(Date.now())),

  triggerIncident: () => {
    const s = get();
    if (!s.ready) return;
    // Restart from the pump's normal duty so the story plays from the top.
    const base = createPulseState(Date.now());
    const pump = base.assets[PULSE_INCIDENT.pumpId];
    set({ ...base, incident: { startedAt: Date.now(), from: { duty: pump.op.duty, speed: pump.op.speed } } });
  },

  acknowledge: (obsId) =>
    set((s) => ({ observations: s.observations.map((o) => (o.id === obsId && o.status === "active" ? { ...o, status: "acknowledged" as const } : o)) })),

  createWorkOrder: (obsId) => {
    const s = get();
    const o = s.observations.find((x) => x.id === obsId);
    if (!o) return undefined;
    if (o.workOrderId) return o.workOrderId;
    const wo = raiseWorkOrder(s, o);
    if (wo) set({ observations: s.observations.map((x) => (x.id === obsId ? { ...x, workOrderId: wo } : x)) });
    return wo;
  },
}));

export const selectPulseOpenCount = (s: PulseData) => s.observations.reduce((n, o) => n + (isObsOpen(o) ? 1 : 0), 0);
