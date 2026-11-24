// K-Pulse machine model: from fault severities and the operating point to what the sensors would
// read (vibration, temperature, spectrum) and, for pumps, where the pump sits on its curves.
// Simplified physics for a demo: shapes and directions are realistic, numbers are illustrative.

import { CONFIG } from "../config";
import { clamp } from "../sim/random";
import { ISO_ZONES, KPULSE, type IsoZone } from "./config";
import type { AssetTemplate, FaultKind, Operating, PointReading, PumpReading, PumpSpec, Readings, SensorPoint, Severities } from "./types";

export const FAULT_KINDS: FaultKind[] = ["unbalance", "misalignment", "looseness", "bearing", "lubrication", "cavitation", "electrical", "belt", "wear", "surge"];
export const SENSOR_POINTS: SensorPoint[] = ["motor-nde", "motor-de", "machine-de", "machine-nde"];

export const noSeverities = (): Severities => Object.fromEntries(FAULT_KINDS.map((k) => [k, 0])) as Severities;

/** A noise source in [-1, 1]: seeded for history, Math.random for live readings. */
export type Noise = (key: string) => number;
export const liveNoise: Noise = () => Math.random() * 2 - 1;

const { waterDensity: RHO, g: G, motorEfficiency: MOTOR_ETA } = KPULSE.physics;
const BAR_PER_M = (RHO * G) / 100_000;

// ---- Pump curves ---------------------------------------------------------------------------

/** Head on the factory curve at flow q (m³/h) and speed ratio s (affinity laws). */
export function headOnCurve(p: PumpSpec, q: number, s = 1): number {
  const k = (p.h0 - p.hBep) / (p.qBep * p.qBep);
  return Math.max(0, s * s * p.h0 - k * q * q);
}

/** Pump efficiency at a share x of BEP flow (parabola through 0 and the BEP). */
export const etaAt = (p: PumpSpec, x: number, wear = 0) => clamp(p.etaBep * (2 * x - x * x) * (1 - 0.15 * wear), 0.05, p.etaBep);

/** NPSH required rises with flow and with speed². */
export const npshrAt = (p: PumpSpec, x: number, s = 1) => p.npshrBep * s * s * (0.5 + 0.5 * x * x);

/** NPSH available falls as suction losses rise with flow². */
export const npshaAt = (p: PumpSpec, q: number) => p.npshaStatic - p.npshaDropAtBep * (q / p.qBep) ** 2;

export const hydraulicKw = (qM3h: number, headM: number) => (RHO * G * (qM3h / 3600) * headM) / 1000;

/** Electrical kW drawn at flow q, speed s. */
export function pumpKw(p: PumpSpec, q: number, s: number, wear = 0): number {
  const x = q / (p.qBep * s);
  const head = headOnCurve(p, q, s) * (1 - 0.12 * wear);
  return hydraulicKw(q, head) / etaAt(p, x, wear) / MOTOR_ETA;
}

export function pumpReading(p: PumpSpec, op: Operating, wear: number): PumpReading {
  const s = op.speed;
  const x = op.duty;
  const q = x * p.qBep * s;
  const headM = headOnCurve(p, q, s) * (1 - 0.12 * wear);
  const npshaM = npshaAt(p, q);
  const suctionBar = KPULSE.physics.suctionBar - p.npshaDropAtBep * (q / p.qBep) ** 2 * BAR_PER_M;
  return {
    flowM3h: q,
    headM,
    suctionBar,
    dischargeBar: suctionBar + headM * BAR_PER_M,
    eta: etaAt(p, x, wear),
    npshaM,
    npshrM: npshrAt(p, x, s),
    bepPct: x * 100,
  };
}

/** Cavitation severity that follows from a thin NPSH margin. */
export const cavitationFromMargin = (marginM: number) => clamp((KPULSE.thresholds.npshMarginWarnM - marginM) / 0.8, 0, 1);

/** Extra vibration from running away from the best-efficiency point (recirculation, turbulence). */
export const offBepFactor = (x: number) => 2.2 * (x - 1) ** 2 + Math.max(0, Math.abs(x - 1) - 0.25) * 3;

// ---- Vibration -----------------------------------------------------------------------------

export function zoneOf(v: number, iso: AssetTemplate["iso"]): IsoZone {
  const z = ISO_ZONES[iso];
  return v < z.ab ? "A" : v < z.bc ? "B" : v < z.cd ? "C" : "D";
}

export const pointVelocity = (p: Pick<PointReading, "vx" | "vy" | "vz">) => Math.max(p.vx, p.vy, p.vz);

const BASE_TEMP: Record<AssetTemplate["kind"], number> = { pump: 38, compressor: 52, fan: 36 };

function pointReading(a: AssetTemplate, pt: SensorPoint, sev: Severities, op: Operating, n: Noise): PointReading {
  if (!op.running) return { vx: 0.05, vy: 0.05, vz: 0.04, accelG: 0.01, hfG: 0.01, kurtosis: 3, crest: 3, tempC: 34 + n(`${pt}t`) * 0.5 };
  const onMotor = pt.startsWith("motor");
  const coupling = pt === "motor-de" || pt === "machine-de";
  // A bearing fault reads strongest on its own housing, weaker on the same machine, faint across the coupling.
  const nearBearing = pt === a.bearingAt ? 1 : onMotor === a.bearingAt.startsWith("motor") ? 0.5 : 0.2;
  const s = op.speed;
  const ob = a.kind === "pump" ? offBepFactor(op.duty) : 0;
  const lateBearing = Math.max(0, sev.bearing - 0.55) * 7 * nearBearing;
  const j = (k: string, pct = 0.05) => 1 + n(`${pt}${k}`) * pct;

  const radial =
    (0.55 + 0.45 * op.duty) * s +
    sev.unbalance * 4.6 * s * s +
    sev.misalignment * (coupling ? 1.9 : 0.7) +
    sev.looseness * (onMotor ? 1.4 : 2.4) +
    lateBearing +
    (onMotor ? 0 : sev.cavitation * 2.2 + ob) +
    (onMotor ? sev.electrical * 1.3 : 0) +
    sev.belt * (a.fan?.beltDriven ? 2.0 : 0) +
    sev.surge * (onMotor ? 1.2 : 3.2);
  const axial = (0.4 + 0.3 * op.duty) * s + sev.misalignment * (coupling ? 5.6 : 2.0) + sev.unbalance * 0.8 + sev.looseness * 0.9 + (onMotor ? 0 : sev.cavitation * 0.9);

  const accelG = 0.22 + sev.bearing * 2.2 * nearBearing + (onMotor ? sev.electrical * 0.5 : sev.cavitation * 1.7) + sev.lubrication * 1.1 * nearBearing + sev.looseness * 0.3;
  const hfG = 0.14 + sev.bearing * 4.0 * nearBearing + (onMotor ? 0 : sev.cavitation * 2.6) + sev.lubrication * 1.8 * nearBearing;
  const kurtosis = 3 + sev.bearing * 5.5 * nearBearing + (onMotor ? 0 : sev.cavitation * 1.1) + sev.looseness * 0.6;
  const crest = 3.1 + sev.bearing * 3.4 * nearBearing + (onMotor ? 0 : sev.cavitation * 0.8);
  const tempC =
    BASE_TEMP[a.kind] +
    8 * op.duty +
    (onMotor ? 4 : 0) +
    sev.lubrication * 35 * nearBearing +
    Math.max(0, sev.bearing - 0.5) * 24 * nearBearing +
    (onMotor ? sev.electrical * 12 : 0) +
    sev.misalignment * (coupling ? 6 : 0);

  return {
    vx: radial * 1.05 * j("x"),
    vy: radial * 0.9 * j("y"),
    vz: axial * j("z"),
    accelG: accelG * j("a"),
    hfG: hfG * j("h", 0.07),
    kurtosis: kurtosis + n(`${pt}k`) * 0.15,
    crest: crest + n(`${pt}c`) * 0.12,
    tempC: tempC + n(`${pt}t`) * 0.4,
  };
}

/** Specific power rises at part load even on a healthy compressor (simple demo curve). */
export const partLoadFactor = (duty: number) => 1 + 0.25 * (1 - duty) ** 2;

const SQRT3_V = Math.sqrt(3) * CONFIG.electrical.voltageLL;

export function readingsFor(a: AssetTemplate, sev: Severities, op: Operating, n: Noise): Readings {
  const points = Object.fromEntries(SENSOR_POINTS.map((pt) => [pt, pointReading(a, pt, sev, op, n)])) as Readings["points"];
  let kw = 0;
  let pump: PumpReading | undefined;
  let compressor: Readings["compressor"];
  if (op.running) {
    if (a.pump) {
      pump = pumpReading(a.pump, op, sev.wear);
      kw = hydraulicKw(pump.flowM3h, pump.headM) / pump.eta / MOTOR_ETA;
    } else if (a.compressor) {
      const c = a.compressor;
      kw = a.ratedKw * (0.18 + 0.74 * op.duty);
      const penalty = partLoadFactor(op.duty) + 0.06 * sev.lubrication + 0.06 * sev.electrical + 0.12 * sev.surge;
      compressor = {
        loadPct: op.duty * 100,
        specificPower: c.designSpecificPower * penalty * (1 + n("sp") * 0.01),
        surgeMarginPct: c.style === "centrifugal" ? Math.max(0, 24 * (1 - 1.4 * sev.surge) * (0.55 + 0.45 * op.duty) + n("sm") * 0.6) : undefined,
        cyclesPerHour: c.service === "air" ? Math.max(1, 5 + (1 - op.duty) * 22 + n("cy") * 1.5) : undefined,
        dischargeBar: c.service === "air" ? 7.4 + n("db") * 0.08 : 9.6 + op.duty * 1.2 + n("db") * 0.1,
      };
      kw *= penalty;
    } else {
      kw = a.ratedKw * (0.06 + 0.86 * op.duty ** 2.6) * (1 + sev.belt * 0.04);
    }
    kw *= 1 + n("kw") * 0.012;
  }
  const pf = op.running ? clamp(0.87 - sev.electrical * 0.05 + n("pf") * 0.004, 0.6, 0.99) : 0;
  const currentA = op.running ? (kw * 1000) / (SQRT3_V * pf) * (1 + sev.electrical * 0.06) : 0;
  return { points, kw, currentA, pf, pump, compressor };
}

export function worstPoint(r: Readings): SensorPoint {
  return SENSOR_POINTS.reduce((best, pt) => (pointVelocity(r.points[pt]) > pointVelocity(r.points[best]) ? pt : best), SENSOR_POINTS[0]);
}

/** The point that most needs looking at: high velocity, bearing HF or kurtosis, whichever stands out. */
export function attentionPoint(a: AssetTemplate, r: Readings): SensorPoint {
  const z = ISO_ZONES[a.iso];
  const score = (pt: SensorPoint) => {
    const p = r.points[pt];
    return pointVelocity(p) / z.bc + p.hfG / KPULSE.thresholds.hfWarn + Math.max(0, p.kurtosis - 3) / 2 + Math.max(0, p.tempC - 60) / 20;
  };
  return SENSOR_POINTS.reduce((best, pt) => (score(pt) > score(best) ? pt : best), SENSOR_POINTS[0]);
}

/** Highest value of a reading across the four points. */
export function maxOf(r: Readings, key: keyof PointReading): number {
  return Math.max(...SENSOR_POINTS.map((pt) => r.points[pt][key]));
}

export const maxVelocity = (r: Readings) => Math.max(...SENSOR_POINTS.map((pt) => pointVelocity(r.points[pt])));

// ---- Health score ----------------------------------------------------------------------------

/** 0–100 from the readings, so the score always agrees with what the charts show. */
export function healthFor(a: AssetTemplate, r: Readings, running: boolean): number {
  if (!running) return 100;
  const z = ISO_ZONES[a.iso];
  const v = maxVelocity(r);
  const vScore =
    v < z.ab ? (0.1 * v) / z.ab : v < z.bc ? 0.1 + (0.3 * (v - z.ab)) / (z.bc - z.ab) : v < z.cd ? 0.4 + (0.3 * (v - z.bc)) / (z.cd - z.bc) : Math.min(1, 0.7 + (0.3 * (v - z.cd)) / (0.5 * z.cd));
  const kScore = clamp((maxOf(r, "kurtosis") - 3.3) / 4.7, 0, 1) * 0.75;
  const hfScore = clamp((maxOf(r, "hfG") - 0.4) / 3.6, 0, 1) * 0.8;
  const tScore = clamp((maxOf(r, "tempC") - 62) / 33, 0, 1) * 0.8;
  const margin = r.pump ? r.pump.npshaM - r.pump.npshrM : 99;
  const cavScore = clamp((2 - margin) / 2, 0, 1) * 0.75;
  const bepScore = r.pump ? clamp((Math.abs(r.pump.bepPct - 100) - 20) / 60, 0, 1) * 0.4 : 0;
  const surgeScore = r.compressor?.surgeMarginPct !== undefined ? clamp((15 - r.compressor.surgeMarginPct) / 15, 0, 1) * 0.7 : 0;
  const pfScore = clamp((0.86 - r.pf) / 0.1, 0, 1) * 0.35;
  const scores = [vScore, kScore, hfScore, tScore, cavScore, bepScore, surgeScore, pfScore];
  const worst = Math.max(...scores);
  const rest = scores.reduce((s, x) => s + x, 0) - worst;
  return Math.round(100 - 75 * clamp(worst + 0.1 * rest, 0, 1));
}

// ---- Spectrum ------------------------------------------------------------------------------

export interface SpectrumPeak {
  key: string;
  label: string;
  hz: number;
  /** mm/s, peak. */
  amp: number;
  /** Shown as a marker line on the chart. */
  marker: boolean;
}

/** The discrete peaks in the velocity spectrum at the worst point. */
export function spectrumPeaks(a: AssetTemplate, sev: Severities, op: Operating): SpectrumPeak[] {
  if (!op.running) return [];
  const f1 = (a.rpm * op.speed) / 60;
  const s = op.speed;
  const ob = a.kind === "pump" ? offBepFactor(op.duty) : 0;
  const peaks: SpectrumPeak[] = [
    { key: "1x", label: "1×", hz: f1, amp: 0.35 * s + sev.unbalance * 3.8 * s * s + sev.misalignment * 0.9 + sev.belt * 0.3, marker: true },
    { key: "2x", label: "2×", hz: 2 * f1, amp: 0.12 + sev.misalignment * 3.0 + sev.looseness * 0.9, marker: true },
    { key: "3x", label: "3×", hz: 3 * f1, amp: 0.05 + sev.looseness * 0.8 + sev.misalignment * 0.5, marker: true },
    { key: "4x", label: "4×", hz: 4 * f1, amp: 0.03 + sev.looseness * 0.5, marker: false },
    { key: "5x", label: "5×", hz: 5 * f1, amp: 0.02 + sev.looseness * 0.35, marker: false },
    { key: "100hz", label: "100 Hz", hz: 2 * CONFIG.electrical.frequencyHz, amp: 0.06 + sev.electrical * 2.4, marker: true },
  ];
  const b = a.bearing;
  const bAmp = sev.bearing;
  peaks.push(
    { key: "bpfo", label: "BPFO", hz: b.bpfo * f1, amp: 0.02 + bAmp * 1.6, marker: true },
    { key: "bpfo2", label: "2×BPFO", hz: 2 * b.bpfo * f1, amp: bAmp * 0.9, marker: false },
    { key: "bpfo-sb1", label: "BPFO−1×", hz: (b.bpfo - 1) * f1, amp: bAmp * 0.45, marker: false },
    { key: "bpfo-sb2", label: "BPFO+1×", hz: (b.bpfo + 1) * f1, amp: bAmp * 0.45, marker: false },
    { key: "bpfi", label: "BPFI", hz: b.bpfi * f1, amp: 0.02 + bAmp * 0.25, marker: true },
  );
  if (a.pump) peaks.push({ key: "vane", label: "Vane pass", hz: a.pump.vanes * f1, amp: 0.25 + ob * 1.2 + sev.cavitation * 0.6, marker: true });
  if (a.compressor?.lobes) peaks.push({ key: "lobe", label: "Lobe pass", hz: a.compressor.lobes * f1, amp: 0.3 + sev.lubrication * 0.25, marker: true });
  if (a.compressor?.style === "centrifugal") peaks.push({ key: "subsync", label: "Sub-sync", hz: 0.3 * f1, amp: 0.03 + sev.surge * 2.2, marker: true });
  if (a.fan) {
    peaks.push({ key: "blade", label: "Blade pass", hz: a.fan.blades * f1, amp: 0.18 + sev.unbalance * 0.3, marker: true });
    if (a.fan.beltDriven) {
      peaks.push(
        { key: "belt", label: "Belt", hz: a.fan.beltRatio * f1, amp: 0.12 + sev.belt * 2.2, marker: true },
        { key: "belt2", label: "2×Belt", hz: 2 * a.fan.beltRatio * f1, amp: sev.belt * 1.0, marker: false },
      );
    }
  }
  return peaks;
}

export function spectrumMaxHz(a: AssetTemplate): number {
  const peaks = spectrumPeaks(a, noSeverities(), { running: true, speed: 1, duty: 1 }).filter((p) => p.marker);
  const top = Math.max(...peaks.map((p) => p.hz)) * 1.2;
  return Math.max(300, Math.ceil(top / 50) * 50);
}

const gauss = (f: number, centre: number, sigma: number) => Math.exp(-((f - centre) ** 2) / (2 * sigma * sigma));

/** Velocity spectrum, mm/s, 1 Hz bins, with a seeded noise floor (stable, not flickering). */
export function spectrum(a: AssetTemplate, sev: Severities, op: Operating, seeded: (bin: number) => number): { hz: number; v: number }[] {
  const maxHz = spectrumMaxHz(a);
  const peaks = spectrumPeaks(a, sev, op);
  const step = KPULSE.spectrumStepHz;
  const out: { hz: number; v: number }[] = [];
  for (let f = 0; f <= maxHz; f += step) {
    let v = 0;
    if (op.running) {
      const hump = f > 110 ? gauss(f, 0.62 * maxHz, 0.28 * maxHz) : 0;
      const floor = 0.025 + sev.cavitation * 0.42 * hump + sev.bearing * 0.03 + sev.looseness * 0.04 + sev.lubrication * 0.04;
      v = floor * (0.55 + 0.45 * Math.abs(seeded(f)));
      for (const p of peaks) v += p.amp * gauss(f, p.hz, 1.1);
      if (f < 4) v *= f / 4;
    }
    out.push({ hz: f, v });
  }
  return out;
}

// ---- Operating profile ----------------------------------------------------------------------

/** Daily cooling-load shape in [0, 1], peaking mid-afternoon (Dubai time). */
export function dayShape(dubaiHour: number): number {
  return 0.5 + 0.5 * Math.sin((2 * Math.PI * (dubaiHour - 9)) / 24);
}

export function operatingAt(a: AssetTemplate, dubaiHour: number, n: Noise): Operating {
  const d = dayShape(dubaiHour);
  if (a.kind === "pump") {
    // A VFD holds the pump near the same share of BEP; a fixed-speed pump swings along its curve as valves open and close.
    const duty = a.vfd ? a.duty * (0.96 + 0.07 * d) + n("op") * 0.012 : a.duty * (0.84 + 0.26 * d) + n("op") * 0.03;
    const speed = a.vfd ? clamp(0.86 + 0.12 * d + n("sp") * 0.01, 0.6, 1) : 1;
    return { running: true, speed, duty };
  }
  const duty = clamp(a.duty * (0.82 + 0.3 * d) + n("op") * 0.02, 0.2, 1);
  const speed = a.vfd && a.kind === "fan" ? clamp(0.55 + 0.45 * duty, 0.5, 1) : 1;
  return { running: true, speed, duty };
}
