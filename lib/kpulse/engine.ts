// K-Pulse tick: a pure function from (state, time) to the next state. Each machine follows its
// daily duty, faults sit at their seeded severity, the scripted incident bends one pump's operating
// point, and the diagnosis rules turn readings into observations.

import { DAY, HOUR, dubaiHour } from "../sim/generators";
import { KPULSE } from "./config";
import { ASSET_TEMPLATES } from "./assets";
import { historicState, severitiesAt, toTrendPoint } from "./history";
import { SENSOR_POINTS, cavitationFromMargin, healthFor, liveNoise, operatingAt, pumpReading, readingsFor } from "./physics";
import { diagnose, type Finding } from "./rules";
import { PULSE_INCIDENT, incidentOperating } from "./scenario";
import type { AssetTemplate, Observation, RotatingAsset, SensorPoint, TrendPoint } from "./types";

export interface PulseData {
  ready: boolean;
  now: number;
  /** When the demo started: history is seeded up to here, live values from here on. */
  anchor: number;
  assets: Record<string, RotatingAsset>;
  /** Asset ids in fleet order. */
  assetIds: string[];
  /** Newest first; cleared ones stay for the timeline. */
  observations: Observation[];
  seq: { obs: number };
  incident: { startedAt: number; from: { duty: number; speed: number } } | null;
}

export const EMPTY_PULSE: PulseData = {
  ready: false,
  now: 0,
  anchor: 0,
  assets: {},
  assetIds: [],
  observations: [],
  seq: { obs: 0 },
  incident: null,
};

export const isObsOpen = (o: Observation) => o.status !== "cleared";

function emptyRecent(): Record<SensorPoint, TrendPoint[]> {
  return { "motor-nde": [], "motor-de": [], "machine-de": [], "machine-nde": [] };
}

function updateAsset(a: RotatingAsset, now: number, s: PulseData): RotatingAsset {
  const elapsedS = s.incident ? (now - s.incident.startedAt) / 1000 : undefined;
  let op = operatingAt(a, dubaiHour(now), liveNoise);
  const tripped = elapsedS !== undefined && a.id === PULSE_INCIDENT.standbyId;
  if (tripped) op = { ...op, running: false };
  if (elapsedS !== undefined && a.id === PULSE_INCIDENT.pumpId && s.incident) op = { ...op, ...incidentOperating(elapsedS, s.incident.from) };

  const sev = { ...a.base };
  if (a.pump && op.running) {
    // Cavitation is not scripted: it follows from the NPSH margin, with a little lag.
    const pre = pumpReading(a.pump, op, sev.wear);
    const target = Math.max(a.base.cavitation, cavitationFromMargin(pre.npshaM - pre.npshrM));
    sev.cavitation = a.sev.cavitation + (target - a.sev.cavitation) * 0.3;
  }
  const readings = readingsFor(a, sev, op, liveNoise);
  const health = healthFor(a, readings, op.running);

  const recent = { ...a.recent };
  for (const pt of SENSOR_POINTS) {
    const list = [...recent[pt], toTrendPoint(now, readings, health, pt)];
    if (list.length > KPULSE.recentPoints) list.splice(0, list.length - KPULSE.recentPoints);
    recent[pt] = list;
  }
  return { ...a, sev, op, readings, health, tripped, recent, updatedAt: now };
}

function findingsFor(assets: Record<string, RotatingAsset>, ids: string[], incident: boolean): Finding[] {
  return ids.flatMap((id) => {
    const a = assets[id];
    const isPump = incident && id === PULSE_INCIDENT.pumpId;
    const isStandby = incident && id === PULSE_INCIDENT.standbyId;
    return diagnose({
      asset: a,
      sev: a.sev,
      op: a.op,
      readings: a.readings,
      tripped: a.tripped,
      partnerTripped: isPump ? assets[PULSE_INCIDENT.standbyId]?.tag : undefined,
      takenOverBy: isStandby ? assets[PULSE_INCIDENT.pumpId]?.tag : undefined,
    });
  });
}

export function advancePulse(s: PulseData, now: number): PulseData {
  const assets: Record<string, RotatingAsset> = {};
  for (const id of s.assetIds) assets[id] = updateAsset(s.assets[id], now, s);

  const findings = findingsFor(assets, s.assetIds, !!s.incident);
  const byKey = new Map(findings.map((f) => [f.key, f]));
  const openKeys = new Set(s.observations.filter(isObsOpen).map((o) => o.key));
  const seq = { ...s.seq };

  const raised: Observation[] = findings.filter((f) => !openKeys.has(f.key)).map((f) => ({ ...f, id: `KP-${++seq.obs}`, raisedAt: now, status: "active" }));
  const observations = [
    ...raised.reverse(),
    ...s.observations.map((o) => {
      if (!isObsOpen(o)) return o;
      const f = byKey.get(o.key);
      if (!f) return { ...o, status: "cleared" as const, clearedAt: now };
      // Live fields follow the readings; identity, time and status stay.
      return { ...o, ...f };
    }),
  ].slice(0, 200);

  return { ...s, now, assets, observations, seq };
}

// ---- Initial state ------------------------------------------------------------------------

/** Closed observations from the last 30 days, so the timeline shows the loop being closed. */
const PAST: { assetId: string; kind: Observation["kind"]; title: string; daysAgo: number; durDays: number; resolution: string; priority: Observation["priority"] }[] = [
  { assetId: "marina-a:CHW-P4", kind: "misalignment", title: "Misalignment", daysAgo: 27, durDays: 2, resolution: "Laser-aligned after the motor change. Axial vibration back to 0.9 mm/s.", priority: "P3" },
  { assetId: "reem-res:DWB-P1", kind: "lubrication", title: "Bearing needs grease", daysAgo: 21, durDays: 1, resolution: "Greased at the PPM visit. Bearing back to 49 °C within a day.", priority: "P3" },
  { assetId: "sharjah-hub:AHU-2", kind: "belt", title: "Belt wear or slip", daysAgo: 17, durDays: 3, resolution: "Belt set replaced and re-tensioned. Belt peak gone.", priority: "P3" },
  { assetId: "bb-plaza:CH-1", kind: "surge", title: "Close to surge", daysAgo: 9, durDays: 0.3, resolution: "Condenser water setpoint corrected. Surge margin back above 18 %.", priority: "P2" },
];

function pastObservations(byId: Record<string, AssetTemplate>, anchor: number): Observation[] {
  return PAST.map((p, i) => {
    const a = byId[p.assetId];
    const raisedAt = anchor - p.daysAgo * DAY;
    return {
      id: `KP-${100 + i}`,
      key: `${p.assetId}:${p.kind}:past${i}`,
      assetId: p.assetId,
      buildingId: a.buildingId,
      kind: p.kind,
      priority: p.priority,
      title: p.title,
      summary: p.resolution,
      evidence: [],
      action: "",
      confidence: 0,
      impact: "",
      markers: [],
      raisedAt,
      status: "cleared" as const,
      clearedAt: raisedAt + p.durDays * DAY,
      workOrderId: `WO-${3100 + i * 7}`,
      resolution: p.resolution,
    };
  });
}

export function createPulseState(now: number): PulseData {
  const anchor = now;
  const assets: Record<string, RotatingAsset> = {};
  const assetIds: string[] = [];
  const byId: Record<string, AssetTemplate> = {};
  for (const tpl of ASSET_TEMPLATES) {
    const h = historicState(tpl, anchor, anchor);
    const base = severitiesAt(tpl, anchor, anchor);
    assets[tpl.id] = { ...tpl, base, sev: { ...h.sev }, op: h.op, readings: h.readings, health: h.health, tripped: false, recent: emptyRecent(), updatedAt: now };
    assetIds.push(tpl.id);
    byId[tpl.id] = tpl;
  }

  const past = pastObservations(byId, anchor);
  let state: PulseData = { ...EMPTY_PULSE, ready: true, now, anchor, assets, assetIds, observations: past, seq: { obs: 200 } };
  state = advancePulse(state, now);

  // Back-date the starting observations to the first day the rules would have caught them.
  const observations = state.observations.map((o) => {
    if (!isObsOpen(o)) return o;
    const a = byId[o.assetId];
    for (let d = 30; d >= 1; d--) {
      const t = Math.floor((anchor - d * DAY) / HOUR) * HOUR;
      const h = historicState(a, t, anchor);
      if (diagnose({ asset: a, sev: h.sev, op: h.op, readings: h.readings, tripped: false }).some((f) => f.key === o.key)) return { ...o, raisedAt: t };
    }
    return { ...o, raisedAt: anchor - 6 * HOUR };
  });
  return { ...state, observations };
}
