// Energy and waste calculations for the energy screen (CLAUDE.md §6.4). Pure functions over
// simulation state and the deterministic history model; every assumption lives in CONFIG.

import { CONFIG } from "./config";
import { HOUR, feederHistory } from "./sim/generators";
import { crossChecks } from "./sim/rules";
import type { BmsPoint, BuildingLive, FeederCategory, Panel } from "./types";

/** Monthly cost if a "running while off" load is left alone (hours/day from config, demo assumption). */
export function monthlyWasteAed(kw: number, rateAedPerKwh: number): number {
  return kw * CONFIG.crossCheck.wasteHoursPerDay * 30 * rateAedPerKwh;
}

export interface AfterHoursWindow {
  from: number;
  to: number;
  hoursPerDay: number;
  label: string;
}

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function afterHoursWindow(type: BuildingLive["info"]["type"]): AfterHoursWindow {
  const w = CONFIG.afterHours.window[type];
  const hoursPerDay = (w.to - w.from + 24) % 24;
  return { ...w, hoursPerDay, label: `${hh(w.from)}–${hh(w.to)}` };
}

function inWindow(hour: number, w: AfterHoursWindow): boolean {
  return w.from < w.to ? hour >= w.from && hour < w.to : hour >= w.from || hour < w.to;
}

type WasteCategory = keyof (typeof CONFIG.afterHours.expectedShare)["commercial"];
const isWasteCategory = (c: FeederCategory): c is WasteCategory => c in CONFIG.afterHours.expectedShare.commercial;

export interface WasteFinding {
  id: string;
  kind: "after-hours" | "bms-override";
  title: string;
  where: string;
  /** Plain-language evidence, e.g. "6.2 kW after hours, expected below 1.5 kW". */
  evidence: string;
  wasteKw: number;
  aedPerMonth: number;
  equipment?: string;
}

/**
 * Loads still running when the building should be quiet, worst first.
 * After-hours findings come from the last 24 h of each feeder; BMS overrides come from the live cross-check.
 */
export function findWaste(building: BuildingLive, panels: Panel[], points: BmsPoint[], now: number): WasteFinding[] {
  const type = building.info.type;
  const w = afterHoursWindow(type);
  const residential = type === "Residential" || type === "Residential tower";
  const expected = residential ? CONFIG.afterHours.expectedShare.residential : CONFIG.afterHours.expectedShare.commercial;
  const rate = building.rateAedPerKwh;
  const out: WasteFinding[] = [];

  for (const p of panels) {
    for (const f of p.feeders) {
      if (!isWasteCategory(f.category)) continue;
      const hist = feederHistory({ id: building.info.id, type, peakKw: building.peakKw }, p.share, f, now);
      const night = hist.filter((x) => inWindow(((x.t / HOUR + 4) % 24 + 24) % 24, w));
      if (!night.length) continue;
      const nightKw = night.reduce((a, x) => a + x.kw, 0) / night.length;
      const peakKw = Math.max(...hist.map((x) => x.kw));
      const expectedKw = peakKw * expected[f.category];
      const wasteKw = nightKw - expectedKw;
      const aed = wasteKw * w.hoursPerDay * 30 * rate;
      if (wasteKw <= 0 || aed < CONFIG.afterHours.minAedPerMonth) continue;
      out.push({
        id: f.id,
        kind: "after-hours",
        title: `${f.name} on after hours`,
        where: `${p.name} · ${p.location}`,
        evidence: `${wasteKw + expectedKw >= 10 ? Math.round(nightKw) : nightKw.toFixed(1)} kW between ${w.label}, expected below ${expectedKw.toFixed(1)} kW`,
        wasteKw,
        aedPerMonth: aed,
      });
    }
  }

  const feeders = panels.flatMap((p) => p.feeders);
  for (const c of crossChecks(points, feeders)) {
    if (c.mismatch !== "running-while-off") continue;
    const panel = panels.find((p) => p.feeders.some((f) => f.id === c.feederId));
    out.push({
      id: `xcheck:${c.equipment}`,
      kind: "bms-override",
      title: `${c.equipment} running while the BMS shows OFF`,
      where: panel ? `${panel.name} · ${panel.location}` : "",
      evidence: `${c.kw.toFixed(1)} kW now, found by the BMS cross-check`,
      wasteKw: c.kw,
      aedPerMonth: monthlyWasteAed(c.kw, rate),
      equipment: c.equipment,
    });
  }

  return out.sort((a, b) => b.aedPerMonth - a.aedPerMonth);
}

/** Live building power factor: total kW over total kVA across online panels. */
export function buildingPf(panels: Panel[]): number {
  let kw = 0;
  let kva = 0;
  for (const p of panels) {
    kw += p.incomer.kw;
    kva += p.incomer.pf > 0 ? p.incomer.kw / p.incomer.pf : 0;
  }
  return kva > 0 ? kw / kva : 1;
}

export type PfRisk = "low" | "watch" | "high";
export function pfRisk(pf: number): PfRisk {
  const t = CONFIG.pfPenaltyThreshold;
  return pf < t ? "high" : pf < t + 0.03 ? "watch" : "low";
}

const DUBAI_OFFSET = 4 * HOUR;

/** Epoch ms of Dubai midnight on the 1st of the month containing `ts`, plus that month's length. */
export function dubaiMonth(ts: number, monthsBack = 0): { start: number; days: number } {
  const d = new Date(ts + DUBAI_OFFSET);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() - monthsBack;
  const start = Date.UTC(y, m, 1) - DUBAI_OFFSET;
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return { start, days };
}

export const pctChange = (now: number, before: number) => (before > 0 ? ((now - before) / before) * 100 : 0);
