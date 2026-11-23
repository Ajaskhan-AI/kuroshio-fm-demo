// Pure, deterministic generators: load shapes and history. History is a function of
// (building, time slot), so charts are stable across reloads and need no storage.

import type { BuildingType } from "../buildings";
import { noise } from "./random";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
const DUBAI_OFFSET = 4 * HOUR; // GST, no daylight saving

/** Fractional hour of day in Dubai, 0–24. */
export function dubaiHour(ts: number): number {
  return (((ts + DUBAI_OFFSET) % DAY) + DAY) % DAY / HOUR;
}

/** Epoch ms of the most recent Dubai midnight. */
export function dubaiDayStart(ts: number): number {
  return ts - ((((ts + DUBAI_OFFSET) % DAY) + DAY) % DAY);
}

/** Day of month (1–31) in Dubai. */
export function dubaiDayOfMonth(ts: number): number {
  return new Date(ts + DUBAI_OFFSET).getUTCDate();
}

/** 0 = Sunday … 6 = Saturday, in Dubai. UAE weekend is Saturday–Sunday. */
export function dubaiWeekday(ts: number): number {
  return new Date(ts + DUBAI_OFFSET).getUTCDay();
}

/** Night-time floor as a fraction of peak. Cooling keeps UAE buildings well above zero at night. */
const NIGHT_FLOOR: Record<BuildingType, number> = {
  "Residential tower": 0.55,
  Residential: 0.55,
  Office: 0.35,
  Retail: 0.4,
  "Mixed use": 0.45,
};

/**
 * Load as a fraction of peak for a time of day: peaks 13:00–16:00, lowest 03:00–05:00 (CLAUDE.md §7).
 */
export function loadFactor(type: BuildingType, hour: number): number {
  const floor = NIGHT_FLOOR[type];
  // Cosine centred on 14:30 → minimum around 02:30–04:30; sharpened so the afternoon plateau reads clearly.
  const x = (1 + Math.cos((2 * Math.PI * (hour - 14.5)) / 24)) / 2;
  return floor + (1 - floor) * Math.pow(x, 1.4);
}

/** Weekend dip for offices; residential and retail stay flat. */
function weekdayFactor(type: BuildingType, ts: number): number {
  const wd = dubaiWeekday(ts);
  const weekend = wd === 0 || wd === 6;
  if (!weekend) return 1;
  return type === "Office" ? 0.72 : type === "Mixed use" ? 0.88 : 1;
}

/** Mean of loadFactor over a day, used for daily energy estimates. */
export function meanLoadFactor(type: BuildingType): number {
  let sum = 0;
  for (let h = 0; h < 24; h += 0.25) sum += loadFactor(type, h);
  return sum / 96;
}

const SLOT = 15 * MINUTE;

/** Seeded building load (kW) for any moment; the "true" curve the live values jitter around. */
export function buildingKwAt(id: string, type: BuildingType, peakKw: number, ts: number): number {
  const slot = Math.floor(ts / SLOT);
  const n = noise(id, "kw", slot) * 0.03 + noise(id, "kw-hour", Math.floor(ts / HOUR)) * 0.02;
  return peakKw * loadFactor(type, dubaiHour(ts)) * weekdayFactor(type, ts) * (1 + n);
}

export interface Point {
  t: number;
  kw: number;
}

/** Building kW every `stepMin` minutes over the last `hours`, ending at the slot before `now`. */
export function buildingHistory(id: string, type: BuildingType, peakKw: number, now: number, hours = 24, stepMin = 15): Point[] {
  const step = stepMin * MINUTE;
  const end = Math.floor(now / step) * step;
  const out: Point[] = [];
  for (let t = end - hours * HOUR; t <= end; t += step) out.push({ t, kw: buildingKwAt(id, type, peakKw, t) });
  return out;
}

/** Energy (kWh) from Dubai midnight to `now`, integrated in 5-minute steps. */
export function kwhSinceMidnight(id: string, type: BuildingType, peakKw: number, now: number): number {
  const step = 5 * MINUTE;
  let kwh = 0;
  for (let t = dubaiDayStart(now); t < now; t += step) {
    const dt = Math.min(step, now - t);
    kwh += buildingKwAt(id, type, peakKw, t) * (dt / HOUR);
  }
  return kwh;
}

export interface DayPoint {
  /** Dubai midnight of the day. */
  day: number;
  kwh: number;
  peakKw: number;
}

/** Daily energy for the last `days` complete days (oldest first). */
export function dailyHistory(id: string, type: BuildingType, peakKw: number, now: number, days = 30): DayPoint[] {
  const today = dubaiDayStart(now);
  const mean = meanLoadFactor(type);
  const out: DayPoint[] = [];
  for (let d = days; d >= 1; d--) {
    const day = today - d * DAY;
    const wf = weekdayFactor(type, day + 12 * HOUR);
    const n = 1 + noise(id, "day", Math.floor(day / DAY)) * 0.05;
    out.push({ day, kwh: peakKw * mean * 24 * wf * n, peakKw: peakKw * wf * (1 + noise(id, "peak", Math.floor(day / DAY)) * 0.04) });
  }
  return out;
}

/** Typical monthly consumption, for the blended tariff rate. */
export function typicalMonthlyKwh(type: BuildingType, peakKw: number): number {
  return peakKw * meanLoadFactor(type) * 24 * 30;
}
