// The scripted incident on Marina Tower A (CLAUDE.md §7). Pure functions of "seconds since the
// presenter pressed I"; the engine applies them each tick, and the normal rules turn the
// resulting readings into alarms, work orders, findings and report lines — nothing is faked
// downstream.
//
//  0 s   SMDB-04 starts heating: 41 → 63 °C over 40 s (P3 "running hot" ~45 °C, P1 "overheating" > 60 °C)
//  10 s  AHU-3: BMS reports OFF (schedule) but the feeder keeps drawing 18.4 kW → BMS cross-check
//  20 s  CHW Pump-2 health slides 84 → 58 over 15 s → predictive alarm below 70

import type { Asset, Fault } from "../types";
import { estimateDaysToFailure, recommendationFor } from "./assets";
import { clamp } from "./random";

export const INCIDENT = {
  buildingId: "marina-a",
  panelId: "marina-a:SMDB-04",
  ahuPointId: "marina-a:AHU-3:fan-status",
  ahuKw: 18.4,
  pumpId: "marina-a:CHWP-2",
  temp: { from: 41, to: 63, startS: 0, rampS: 40 },
  ahuStartS: 10,
  pump: { from: 84, to: 58, startS: 20, rampS: 15 },
} as const;

const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

/** SMDB-04 temperature, °C, at `elapsedS` seconds into the incident. */
export function incidentPanelTemp(elapsedS: number): number {
  const { from, to, startS, rampS } = INCIDENT.temp;
  return from + (to - from) * easeInOut(clamp((elapsedS - startS) / rampS, 0, 1));
}

/** Faults the incident adds on top of the random ones (recomputed each tick, never stored). */
export function incidentFaults(startedAt: number, now: number): Fault[] {
  const elapsedS = (now - startedAt) / 1000;
  if (elapsedS < INCIDENT.ahuStartS) return [];
  return [
    {
      id: "INC-AHU3",
      kind: "bms-override",
      buildingId: INCIDENT.buildingId,
      pointId: INCIDENT.ahuPointId,
      startedAt: startedAt + INCIDENT.ahuStartS * 1000,
      endsAt: Number.POSITIVE_INFINITY,
      kw: INCIDENT.ahuKw,
    },
  ];
}

/** CHW Pump-2 as it looks `elapsedS` into the incident, or null before its decline starts. */
export function incidentPump(asset: Asset, baseline: Asset, elapsedS: number): Asset | null {
  const { from, to, startS, rampS } = INCIDENT.pump;
  if (elapsedS < startS) return null;
  const health = Math.round(from + (to - from) * clamp((elapsedS - startS) / rampS, 0, 1));
  if (health === asset.health) return null;
  // Rewrite the last week of history so the 30-day chart shows the slide, not a cliff.
  const hist = [...baseline.healthHistory];
  const days = 7;
  const start = hist[hist.length - 1 - days];
  for (let d = 1; d <= days; d++) hist[hist.length - 1 - days + d] = Math.round((start + ((health - start) * d) / days) * 10) / 10;
  hist[hist.length - 1] = health;
  const signatureHistory = hist.map((h, i) => Math.max(baseline.signatureHistory[i], Math.round(((100 - h) / 10) * 100) / 100));
  const daysToFailure = estimateDaysToFailure(health, hist);
  return { ...asset, health, healthHistory: hist, signatureHistory, daysToFailure, recommendation: recommendationFor(asset.type, health, daysToFailure) };
}
