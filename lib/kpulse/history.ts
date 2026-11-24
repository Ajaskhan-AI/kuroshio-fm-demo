// Seeded history for K-Pulse: every past reading is a pure function of (asset, time), so charts are
// full on first load and look the same on every reload. Faults grow along their tracks up to the
// moment the demo started ("anchor"); from then on the live engine takes over.

import { DAY, HOUR, MINUTE, dubaiHour } from "../sim/generators";
import { clamp, noise } from "../sim/random";
import { healthFor, maxVelocity, noSeverities, operatingAt, readingsFor, type Noise } from "./physics";
import type { AssetTemplate, Operating, Readings, SensorPoint, Severities, TrendPoint } from "./types";

export type { TrendPoint };

export function severitiesAt(a: AssetTemplate, t: number, anchor: number): Severities {
  const sev = noSeverities();
  for (const f of a.faults) {
    const start = anchor - f.startDaysAgo * DAY;
    const p = clamp((t - start) / (anchor - start), 0, 1);
    sev[f.kind] = f.to * p ** 1.7;
  }
  return sev;
}

export interface HistoricState {
  sev: Severities;
  op: Operating;
  readings: Readings;
  health: number;
}

const SLOT = 5 * MINUTE;

export function historicState(a: AssetTemplate, t: number, anchor: number): HistoricState {
  const slot = Math.floor(t / SLOT);
  const n: Noise = (k) => noise(a.id, slot, k);
  const sev = severitiesAt(a, t, anchor);
  const op = operatingAt(a, dubaiHour(t), n);
  const readings = readingsFor(a, sev, op, n);
  return { sev, op, readings, health: healthFor(a, readings, op.running) };
}

export type RangeKey = "24h" | "7d" | "30d";
export const RANGES: Record<RangeKey, { label: string; hours: number; step: number }> = {
  "24h": { label: "24 h", hours: 24, step: 5 * MINUTE },
  "7d": { label: "7 days", hours: 168, step: 30 * MINUTE },
  "30d": { label: "30 days", hours: 720, step: 2 * HOUR },
};

export function toTrendPoint(t: number, r: Readings, health: number, pt: SensorPoint): TrendPoint {
  const p = r.points[pt];
  return {
    t,
    vx: p.vx,
    vy: p.vy,
    vz: p.vz,
    accel: p.accelG,
    hf: p.hfG,
    kurt: p.kurtosis,
    crest: p.crest,
    temp: p.tempC,
    health,
    kw: r.kw,
    currentA: r.currentA,
    pf: r.pf,
    sp: r.compressor?.specificPower,
    surge: r.compressor?.surgeMarginPct,
    load: r.compressor?.loadPct,
    cycles: r.compressor?.cyclesPerHour,
  };
}

/** One sensor point's readings over a range, ending at `end` (aligned to the step so it is stable). */
export function trend(a: AssetTemplate, pt: SensorPoint, end: number, range: RangeKey, anchor: number): TrendPoint[] {
  const { hours, step } = RANGES[range];
  const last = Math.floor(end / step) * step;
  const n = Math.round((hours * HOUR) / step);
  const out: TrendPoint[] = [];
  for (let i = n; i >= 0; i--) {
    const t = last - i * step;
    const h = historicState(a, t, anchor);
    out.push(toTrendPoint(t, h.readings, h.health, pt));
  }
  return out;
}

/** Health once a day for 30 days (at 14:00 Dubai, a busy hour), oldest first. */
export function dailyHealth(a: AssetTemplate, anchor: number, days = 30): number[] {
  const out: number[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const t = Math.floor((anchor - d * DAY) / HOUR) * HOUR;
    out.push(historicState(a, t, anchor).health);
  }
  return out;
}

export interface PumpSample {
  t: number;
  q: number;
  h: number;
  kw: number;
  eta: number;
  v: number;
  speed: number;
}

/** Pump operating points over 30 days: one every `stepH` hours at a seeded time of day. */
export function pumpSamples(a: AssetTemplate, anchor: number, stepH = 4, days = 30): PumpSample[] {
  if (!a.pump) return [];
  const out: PumpSample[] = [];
  const start = Math.floor(anchor / HOUR) * HOUR - days * DAY;
  for (let t = start; t < anchor; t += stepH * HOUR) {
    const h = historicState(a, t, anchor);
    const p = h.readings.pump;
    if (!p) continue;
    out.push({ t, q: p.flowM3h, h: p.headM, kw: h.readings.kw, eta: p.eta, v: maxVelocity(h.readings), speed: h.op.speed });
  }
  return out;
}

/** Specific energy, kWh per m³ pumped, one value a day for 30 days. */
export function dailySpecificEnergy(a: AssetTemplate, anchor: number, days = 30): { t: number; kwhPerM3: number }[] {
  if (!a.pump) return [];
  const out: { t: number; kwhPerM3: number }[] = [];
  const today = Math.floor(anchor / DAY) * DAY;
  for (let d = days - 1; d >= 0; d--) {
    const day = today - d * DAY;
    let kwh = 0;
    let m3 = 0;
    for (let hr = 0; hr < 24; hr += 2) {
      const h = historicState(a, day + hr * HOUR, anchor);
      kwh += h.readings.kw * 2;
      m3 += (h.readings.pump?.flowM3h ?? 0) * 2;
    }
    out.push({ t: day, kwhPerM3: m3 ? kwh / m3 : 0 });
  }
  return out;
}
