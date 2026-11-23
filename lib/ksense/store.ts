"use client";

// K-Sense cold-chain simulation store. Ticked by the same SimRunner as the FM simulation and
// reset with it, but kept apart: cold stores are their own portfolio with their own alarms.

import { create } from "zustand";
import { COLD_INCIDENT } from "./scenario";
import { EMPTY_COLD, advanceCold, createColdState, isColdOpen, type ColdData } from "./engine";

interface ColdActions {
  init: () => void;
  tick: (now?: number) => void;
  reset: () => void;
  /** Start (or restart) the scripted door-open + refrigerant-leak incident. */
  triggerIncident: () => void;
  acknowledge: (alarmId: string) => void;
}

export type ColdStore = ColdData & ColdActions;

export const useCold = create<ColdStore>()((set, get) => ({
  ...EMPTY_COLD,

  init: () => {
    if (get().ready) return;
    set(createColdState(Date.now()));
  },

  tick: (now = Date.now()) => {
    if (!get().ready) return;
    set((s) => advanceCold(s, now));
  },

  reset: () => set(createColdState(Date.now())),

  triggerIncident: () => {
    const s = get();
    if (!s.ready) return;
    // Restart from a clean chamber so the story plays from the top.
    const id = COLD_INCIDENT.doorChamberId;
    const ch = s.chambers[id];
    set({ incident: { startedAt: Date.now() }, chambers: { ...s.chambers, [id]: { ...ch, tempC: COLD_INCIDENT.temp.from } } });
  },

  acknowledge: (alarmId) =>
    set((s) => ({ alarms: s.alarms.map((a) => (a.id === alarmId && a.status === "active" ? { ...a, status: "acknowledged" as const } : a)) })),
}));

export const selectColdOpenCount = (s: ColdData) => s.alarms.reduce((n, a) => n + (isColdOpen(a) ? 1 : 0), 0);
