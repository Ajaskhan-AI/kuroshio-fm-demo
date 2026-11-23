import type { Alarm, Asset, BmsPoint, BuildingLive, Fault, Panel, Technician, WorkOrder } from "../types";

/** Everything the simulation owns. Screens read slices of this through the Zustand store. */
export interface SimData {
  ready: boolean;
  /** Time of the last tick (epoch ms). */
  now: number;
  startedAt: number;
  buildings: Record<string, BuildingLive>;
  panels: Record<string, Panel>;
  /** Panel ids per building, in SMDB-01 … SMDB-08 order. */
  panelIds: Record<string, string[]>;
  bmsPoints: Record<string, BmsPoint[]>;
  assets: Record<string, Asset>;
  /** Newest first. */
  alarms: Alarm[];
  /** Newest first. */
  workOrders: WorkOrder[];
  technicians: Technician[];
  faults: Fault[];
  nextMinorAt: number;
  seq: { alarm: number; workOrder: number; fault: number };
}

export const EMPTY_SIM: SimData = {
  ready: false,
  now: 0,
  startedAt: 0,
  buildings: {},
  panels: {},
  panelIds: {},
  bmsPoints: {},
  assets: {},
  alarms: [],
  workOrders: [],
  technicians: [],
  faults: [],
  nextMinorAt: 0,
  seq: { alarm: 0, workOrder: 0, fault: 0 },
};

export const isOpen = (a: Alarm) => a.status !== "cleared";
