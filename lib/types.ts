import type { Priority } from "./config";
import type { BuildingInfo } from "./buildings";

export type { Priority };

/** Display status used by chips, pins and cards. Always shown with icon + text, never colour alone. */
export type HealthStatus = "online" | "warning" | "alarm" | "offline";

export type Triple = [number, number, number];

export type FeederCategory = "cooling" | "pumps" | "ventilation" | "lighting" | "power" | "lifts" | "ev";

export interface Feeder {
  id: string;
  panelId: string;
  name: string;
  category: FeederCategory;
  /** Breaker rating, A. */
  ratedA: number;
  /** Share of the panel's load (0–1). */
  share: number;
  pfBase: number;
  /** Per-phase current multipliers; normal panels are within ±3 %. */
  phaseSkew: Triple;
  // Live values
  v: Triple;
  i: Triple;
  pf: number;
  kw: number;
  kwhToday: number;
  tripped: boolean;
}

export type PanelStatus = "online" | "offline" | "tripped";

export interface Panel {
  id: string;
  buildingId: string;
  /** "SMDB-01" … "SMDB-08". */
  name: string;
  location: string;
  share: number;
  baseTempC: number;
  vBase: number;
  status: PanelStatus;
  tempC: number;
  feeders: Feeder[];
  incomer: { v: Triple; i: Triple; pf: number; kw: number; kwhToday: number };
  updatedAt: number;
}

export type BmsSystem = "AHU" | "Chiller" | "FCU" | "Pump" | "Zone";

export interface BmsPoint {
  id: string;
  buildingId: string;
  system: BmsSystem;
  equipment: string;
  name: string;
  kind: "analog" | "status";
  /** Analog value, or 1 / 0 for on / off. */
  value: number;
  unit: string;
  base: number;
  setpoint?: number;
  updatedAt: number;
}

export interface BmsConnection {
  protocol: "BACnet/IP";
  devicesDiscovered: number;
  pointsMapped: number;
  lastSyncAt: number;
  status: "online" | "offline";
}

export type AssetType = "Chilled water pump" | "Condenser pump" | "AHU fan";

export interface Asset {
  id: string;
  buildingId: string;
  name: string;
  type: AssetType;
  location: string;
  health: number;
  /** Daily health over the last 30 days, oldest first. */
  healthHistory: number[];
  /** Motor current signature indicator over 30 days (higher = more degradation). */
  signatureHistory: number[];
  daysToFailure: number | null;
  recommendation: string;
}

export type AlarmSource = "meter" | "bms" | "predictive";

export type AlarmType =
  | "overheating"
  | "panel-hot"
  | "overload"
  | "phase-imbalance"
  | "low-pf"
  | "voltage-high"
  | "voltage-low"
  | "feeder-trip"
  | "panel-offline"
  | "filter-dirty"
  | "zone-warm"
  | "bms-mismatch"
  | "asset-degrading";

export interface AlarmTarget {
  panelId?: string;
  feederId?: string;
  assetId?: string;
  equipment?: string;
}

export interface Alarm {
  id: string;
  /** Stable condition key; one active alarm per key. */
  key: string;
  buildingId: string;
  source: AlarmSource;
  priority: Priority;
  type: AlarmType;
  /** Plain FM language, e.g. "Panel overheating". */
  title: string;
  detail: string;
  target: AlarmTarget;
  raisedAt: number;
  status: "active" | "acknowledged" | "cleared";
  clearedAt?: number;
  workOrderId?: string;
}

export type Trade = "Electrical" | "HVAC" | "BMS" | "Mechanical";

export interface Technician {
  id: string;
  name: string;
  trade: Trade;
}

export type WorkOrderStatus = "open" | "in_progress" | "closed";

export interface WorkOrder {
  id: string;
  alarmId?: string;
  buildingId: string;
  priority: Priority;
  title: string;
  technicianId: string;
  status: WorkOrderStatus;
  createdAt: number;
  slaDueAt: number;
  respondedAt?: number;
  closedAt?: number;
  /** Simulated technician pickup time for live work orders. */
  plannedResponseAt?: number;
  autoCreated: boolean;
}

export interface BuildingLive {
  info: BuildingInfo;
  /** Design peak load, kW. */
  peakKw: number;
  /** Blended AED per kWh incl. fuel surcharge, from the demo tariff. */
  rateAedPerKwh: number;
  kw: number;
  kwhToday: number;
  costTodayAed: number;
  openAlarms: number;
  health: number;
  status: HealthStatus;
  topIssue?: string;
  manualReadingsAvoided: number;
  bms: BmsConnection;
  updatedAt: number;
}

export type FaultKind =
  | "low-pf"
  | "imbalance"
  | "overload"
  | "feeder-trip"
  | "voltage-low"
  | "panel-hot"
  | "panel-offline"
  | "filter-dp"
  | "zone-hot";

/** A temporary condition injected into the simulation; rules turn its effects into alarms. */
export interface Fault {
  id: string;
  kind: FaultKind;
  buildingId: string;
  panelId?: string;
  feederId?: string;
  pointId?: string;
  startedAt: number;
  endsAt: number;
}
