"use client";

// The single simulation store (CLAUDE.md §7). One tick updates everything; every screen
// subscribes to the slice it needs, so one event shows up everywhere at once.

import { create } from "zustand";
import type { Priority } from "../config";
import type { Trade, WorkOrderStatus } from "../types";
import { advance, newWorkOrder } from "./engine";
import { INCIDENT } from "./scenario";
import { createInitialState } from "./seed";
import { EMPTY_SIM, isOpen, type SimData } from "./state";

interface SimActions {
  /** Build the portfolio on the client (live values depend on the clock, so never on the server). */
  init: () => void;
  tick: (now?: number) => void;
  reset: () => void;
  /** Start (or restart) the scripted Marina Tower A incident. */
  triggerIncident: () => void;
  acknowledgeAlarm: (alarmId: string) => void;
  /** Manual work order, e.g. from the BMS cross-check or an asset page. Returns its id. */
  createWorkOrder: (input: { buildingId: string; priority: Priority; title: string; trade: Trade; alarmId?: string }) => string;
  setWorkOrderStatus: (id: string, status: WorkOrderStatus) => void;
}

export type SimStore = SimData & SimActions;

export const useSim = create<SimStore>()((set, get) => ({
  ...EMPTY_SIM,

  init: () => {
    if (get().ready) return;
    set(createInitialState(Date.now()));
  },

  tick: (now = Date.now()) => {
    if (!get().ready) return;
    set((s) => advance(s, now));
  },

  reset: () => set(createInitialState(Date.now())),

  triggerIncident: () => {
    const s = get();
    if (!s.ready) return;
    // Restarting mid-incident: begin again from the pump's pre-incident state.
    const pumpBaseline = s.incident?.pumpBaseline ?? s.assets[INCIDENT.pumpId];
    set({ incident: { startedAt: Date.now(), pumpBaseline }, assets: { ...s.assets, [INCIDENT.pumpId]: pumpBaseline } });
  },

  acknowledgeAlarm: (alarmId) =>
    set((s) => ({
      alarms: s.alarms.map((a) => (a.id === alarmId && a.status === "active" ? { ...a, status: "acknowledged" as const } : a)),
    })),

  createWorkOrder: (input) => {
    const s = get();
    const existing = input.alarmId ? s.workOrders.find((w) => w.alarmId === input.alarmId && w.status !== "closed") : undefined;
    if (existing) return existing.id;
    const seq = s.seq.workOrder + 1;
    const wo = newWorkOrder(s, seq, { ...input, autoCreated: false }, Date.now());
    set({
      workOrders: [wo, ...s.workOrders],
      seq: { ...s.seq, workOrder: seq },
      alarms: input.alarmId ? s.alarms.map((a) => (a.id === input.alarmId ? { ...a, workOrderId: wo.id } : a)) : s.alarms,
    });
    return wo.id;
  },

  setWorkOrderStatus: (id, status) =>
    set((s) => {
      const now = Date.now();
      return {
        workOrders: s.workOrders.map((w) => {
          if (w.id !== id || w.status === status) return w;
          if (status === "in_progress") return { ...w, status, respondedAt: w.respondedAt ?? now };
          if (status === "closed") return { ...w, status, respondedAt: w.respondedAt ?? now, closedAt: now };
          return { ...w, status, respondedAt: undefined, closedAt: undefined };
        }),
      };
    }),
}));

// ---- Selectors (stable, cheap) -----------------------------------------------------------

export const selectOpenAlarmCount = (s: SimData) => s.alarms.reduce((n, a) => n + (isOpen(a) ? 1 : 0), 0);
