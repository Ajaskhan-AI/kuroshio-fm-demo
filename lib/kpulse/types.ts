import type { Priority } from "../config";
import type { IsoGroup, IsoZone } from "./config";

export type { IsoZone };

export type MachineKind = "pump" | "compressor" | "fan";

/** Conditions the simulation can develop; each has a severity 0 (none) … 1 (severe). */
export type FaultKind =
  | "unbalance"
  | "misalignment"
  | "looseness"
  | "bearing"
  | "lubrication"
  | "cavitation"
  | "electrical"
  | "belt"
  | "wear"
  | "surge";

export type Severities = Record<FaultKind, number>;

/** Sensor positions on the train: motor non-drive end, motor drive end, machine drive end, machine non-drive end. */
export type SensorPoint = "motor-nde" | "motor-de" | "machine-de" | "machine-nde";

export interface PumpSpec {
  /** Best-efficiency flow (m³/h) and head (m) at rated speed. */
  qBep: number;
  hBep: number;
  /** Shut-off head at rated speed, m. */
  h0: number;
  /** Pump efficiency at BEP, 0–1. */
  etaBep: number;
  /** NPSH required at BEP and rated speed, m. */
  npshrBep: number;
  /** NPSH available at zero flow, m, and its fall at BEP flow (suction losses rise with flow²). */
  npshaStatic: number;
  npshaDropAtBep: number;
  vanes: number;
  /** Measured by a flow meter, or estimated by the virtual flow meter. */
  flowSource: "meter" | "virtual";
}

export interface CompressorSpec {
  style: "centrifugal" | "screw";
  /** What it serves: a chiller (kW/TR) or compressed air (kW per m³/min). */
  service: "chiller" | "air";
  /** Design specific power in the service's unit. */
  designSpecificPower: number;
  /** Male-rotor lobes (screw only). */
  lobes?: number;
  /** Design capacity: TR for chillers, m³/min for air. */
  capacity: number;
}

export interface FanSpec {
  beltDriven: boolean;
  /** Belt pass frequency as a multiple of motor speed. */
  beltRatio: number;
  blades: number;
}

export interface FaultTrack {
  kind: FaultKind;
  /** Severity starts rising this many days before the demo started… */
  startDaysAgo: number;
  /** …and reaches this value at the start of the demo. */
  to: number;
}

export interface AssetTemplate {
  id: string;
  buildingId: string;
  tag: string;
  name: string;
  kind: MachineKind;
  /** Plain label, e.g. "Chilled water pump". */
  typeLabel: string;
  location: string;
  ratedKw: number;
  /** Rated motor speed, rpm. */
  rpm: number;
  vfd: boolean;
  iso: IsoGroup;
  /** Bearing defect frequencies as multiples of running speed. */
  bearing: { bpfo: number; bpfi: number; bsf: number; ftf: number };
  /** Where the bearing / lubrication fault sits. */
  bearingAt: SensorPoint;
  /** Normal share of BEP flow (pumps) or load (others), 0–1.5. */
  duty: number;
  pump?: PumpSpec;
  compressor?: CompressorSpec;
  fan?: FanSpec;
  faults: FaultTrack[];
}

export interface PointReading {
  /** Velocity RMS, mm/s: horizontal, vertical, axial. */
  vx: number;
  vy: number;
  vz: number;
  /** Acceleration RMS, g. */
  accelG: number;
  /** High-frequency / envelope acceleration, gE. */
  hfG: number;
  kurtosis: number;
  crest: number;
  tempC: number;
}

export interface Operating {
  running: boolean;
  /** VFD speed as a share of rated, 0–1. */
  speed: number;
  /** Pumps: flow as a share of BEP flow at the current speed. Others: load, 0–1. */
  duty: number;
}

export interface PumpReading {
  flowM3h: number;
  headM: number;
  suctionBar: number;
  dischargeBar: number;
  /** Pump efficiency, 0–1. */
  eta: number;
  npshaM: number;
  npshrM: number;
  /** Share of BEP flow at the current speed, %. */
  bepPct: number;
}

export interface CompressorReading {
  loadPct: number;
  specificPower: number;
  /** Centrifugal only. */
  surgeMarginPct?: number;
  /** Screw air compressors: load/unload cycles per hour. */
  cyclesPerHour?: number;
  dischargeBar: number;
}

export interface Readings {
  points: Record<SensorPoint, PointReading>;
  kw: number;
  currentA: number;
  pf: number;
  pump?: PumpReading;
  compressor?: CompressorReading;
}

export interface RotatingAsset extends AssetTemplate {
  /** Severities at the start of the demo (from the fault tracks). */
  base: Severities;
  // Live
  sev: Severities;
  op: Operating;
  readings: Readings;
  health: number;
  /** Tripped during the incident (stand-by pump). */
  tripped: boolean;
  /** Last few minutes of live readings per sensor point, appended to the history charts. */
  recent: Record<SensorPoint, TrendPoint[]>;
  updatedAt: number;
}

/** One sample of one sensor point, plus the machine-level values, for the charts. */
export interface TrendPoint {
  t: number;
  vx: number;
  vy: number;
  vz: number;
  accel: number;
  hf: number;
  kurt: number;
  crest: number;
  temp: number;
  health: number;
  kw: number;
  currentA: number;
  pf: number;
  /** Compressors. */
  sp?: number;
  surge?: number;
  load?: number;
  cycles?: number;
}

export type ObservationKind =
  | "cavitation"
  | "off-bep"
  | "bearing"
  | "lubrication"
  | "unbalance"
  | "misalignment"
  | "looseness"
  | "electrical"
  | "belt"
  | "surge"
  | "wear"
  | "stopped"
  | "zone";

export interface Observation {
  id: string;
  key: string;
  assetId: string;
  buildingId: string;
  kind: ObservationKind;
  priority: Priority;
  title: string;
  /** Plain-language one-liner for FM managers. */
  summary: string;
  /** The readings that led to it, for engineers. */
  evidence: string[];
  action: string;
  /** AI confidence, %. */
  confidence: number;
  /** Money at stake if it is left: energy lost per month and / or repair avoided. */
  impact: string;
  /** Spectrum markers this diagnosis leans on. */
  markers: string[];
  raisedAt: number;
  status: "active" | "acknowledged" | "cleared";
  clearedAt?: number;
  workOrderId?: string;
  /** Closed in the past, for the timeline. */
  resolution?: string;
}
