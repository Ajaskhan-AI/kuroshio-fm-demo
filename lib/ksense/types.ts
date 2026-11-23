import type { Priority } from "../config";
import type { ChamberType } from "./config";

export type { ChamberType };

export interface ColdSite {
  id: string;
  name: string;
  short: string;
  area: string;
}

export interface RefrigerationUnit {
  name: string;
  suctionBar: number;
  dischargeBar: number;
  kw: number;
  running: boolean;
}

export interface Chamber {
  id: string;
  siteId: string;
  /** "FR-01", "CH-02", "PH-01", "PR-01". */
  name: string;
  type: ChamberType;
  product: string;
  pallets: number;
  /** Value of the stock inside, AED. */
  stockAed: number;
  /** Seeded offset from the setpoint, so chambers don't all read the same. */
  offsetC: number;
  /** Seeded phase of the defrost timer, ms (frozen only). */
  defrostPhaseMs: number;
  // Live values
  tempC: number;
  rhPct: number;
  doorOpen: boolean;
  doorOpenSince?: number;
  doorClosedAt?: number;
  roomPa: number;
  defrosting: boolean;
  unit: RefrigerationUnit;
  sensor: { batteryPct: number; signal: "good" | "fair"; lastSeenAt: number };
  /** Last few minutes of live readings for the chart. */
  recent: { t: number; c: number }[];
  updatedAt: number;
}

export type ColdAlarmType = "temp-high" | "temp-low" | "door-open" | "refrigerant-leak" | "discharge-high" | "relief-iced" | "battery-low";

export interface ColdAlarm {
  id: string;
  key: string;
  chamberId: string;
  siteId: string;
  priority: Priority;
  type: ColdAlarmType;
  predictive: boolean;
  title: string;
  detail: string;
  raisedAt: number;
  status: "active" | "acknowledged" | "cleared";
  clearedAt?: number;
}

export interface Excursion {
  id: string;
  chamberId: string;
  siteId: string;
  startedAt: number;
  endedAt?: number;
  peakC: number;
  limitC: number;
  cause: string;
}

/** Temporary conditions injected into the cold-chain simulation. */
export interface ColdFaults {
  /** Chambers whose pressure relief port is iced. */
  reliefIced: string[];
  /** Door held open until this time, per chamber id (normal dock work). */
  doorUntil: Record<string, number>;
}
