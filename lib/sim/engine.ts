// The simulation tick: a pure function from (state, time) to the next state.
// Live values jitter around the seeded load curve, faults bend them, rules turn them
// into alarms, and alarms open work orders. Every screen reads the result.

import { BUILDINGS } from "../buildings";
import { CONFIG, type Priority } from "../config";
import type {
  Alarm,
  BmsPoint,
  BuildingLive,
  Fault,
  FaultKind,
  HealthStatus,
  Panel,
  Trade,
  Triple,
  WorkOrder,
} from "../types";
import { HOUR, MINUTE, buildingKwAt, dubaiDayOfMonth, dubaiDayStart, dubaiHour, loadFactor } from "./generators";
import { between, clamp, jitter, pick } from "./random";
import { assetConditions, bmsConditions, panelConditions, type Condition } from "./rules";
import { isOpen, type SimData } from "./state";

const SQRT3 = Math.sqrt(3);
const PRIORITY_RANK: Record<Priority, number> = { P1: 0, P2: 1, P3: 2 };
const HEALTH_PENALTY: Record<Priority, number> = { P1: 25, P2: 12, P3: 5 };
const MAX_CLEARED_ALARMS = 150;

interface FaultIndex {
  panel: Map<string, Set<FaultKind>>;
  feeder: Map<string, Set<FaultKind>>;
  point: Map<string, Set<FaultKind>>;
}

function indexFaults(faults: Fault[]): FaultIndex {
  const idx: FaultIndex = { panel: new Map(), feeder: new Map(), point: new Map() };
  const add = (m: Map<string, Set<FaultKind>>, k: string | undefined, kind: FaultKind) => {
    if (!k) return;
    if (!m.has(k)) m.set(k, new Set());
    m.get(k)!.add(kind);
  };
  for (const f of faults) {
    if (f.feederId) add(idx.feeder, f.feederId, f.kind);
    else if (f.panelId) add(idx.panel, f.panelId, f.kind);
    if (f.pointId) add(idx.point, f.pointId, f.kind);
  }
  return idx;
}

function updatePanel(p: Panel, buildingKw: number, lf: number, dt: number, now: number, faults: FaultIndex): Panel {
  const pf = faults.panel.get(p.id);
  if (pf?.has("panel-offline")) {
    // Meter silent: keep the last values, status offline, no new timestamp.
    return p.status === "offline" ? p : { ...p, status: "offline" };
  }

  const vScale = pf?.has("voltage-low") ? 0.875 : 1;
  const v: Triple = [p.vBase * vScale * jitter(0.004), p.vBase * vScale * jitter(0.004), p.vBase * vScale * jitter(0.004)];
  const panelKw = buildingKw * p.share;
  const hours = dt / HOUR;

  let sumKw = 0;
  let sumKva = 0;
  let kwhToday = 0;
  const sumI: Triple = [0, 0, 0];

  const feeders = p.feeders.map((f) => {
    const ff = faults.feeder.get(f.id);
    const tripped = ff?.has("feeder-trip") ?? false;
    let pfv = clamp(f.pfBase + (Math.random() - 0.5) * 0.01, 0.5, 0.99);
    if (ff?.has("low-pf")) pfv = 0.805 + Math.random() * 0.02;
    let kw = tripped ? 0 : panelKw * f.share * jitter(0.02);
    if (ff?.has("overload")) {
      // Push the feeder to ~108 % of its breaker rating.
      kw = (f.ratedA * 1.08 * SQRT3 * CONFIG.electrical.voltageLL * pfv) / 1000;
    }
    const skew: Triple = ff?.has("imbalance") ? [1.16, 0.95, 0.87] : f.phaseSkew;
    const iAvg = kw > 0 ? (kw * 1000) / (SQRT3 * CONFIG.electrical.voltageLL * pfv) : 0;
    const i: Triple = [iAvg * skew[0] * jitter(0.01), iAvg * skew[1] * jitter(0.01), iAvg * skew[2] * jitter(0.01)];
    const fk = f.kwhToday + kw * hours;
    sumKw += kw;
    sumKva += kw / pfv;
    kwhToday += fk;
    sumI[0] += i[0];
    sumI[1] += i[1];
    sumI[2] += i[2];
    return { ...f, v, i, pf: pfv, kw, kwhToday: fk, tripped };
  });

  // Panel temperature eases toward a load-dependent target (and a fault target when one applies).
  let target = p.baseTempC + 4 * lf;
  if (pf?.has("panel-hot")) target = 49.5;
  const tempC = p.tempC + (target - p.tempC) * 0.15 + (Math.random() - 0.5) * 0.12;

  return {
    ...p,
    status: feeders.some((f) => f.tripped) ? "tripped" : "online",
    tempC,
    feeders,
    incomer: { v, i: sumI, pf: sumKva > 0 ? sumKw / sumKva : 1, kw: sumKw, kwhToday },
    updatedAt: now,
  };
}

/** Plant runs to a schedule: offices and retail switch AHUs and FCUs off overnight. */
function equipmentOn(type: BuildingLive["info"]["type"], hour: number): boolean {
  if (type === "Office") return hour >= 7 && hour < 20;
  if (type === "Retail") return hour >= 9 && hour < 23;
  if (type === "Mixed use") return hour >= 6 && hour < 23;
  return true; // residential: 24/7
}

function updateBms(points: BmsPoint[], b: BuildingLive, hour: number, lf: number, now: number, faults: FaultIndex): BmsPoint[] {
  const scheduled = equipmentOn(b.info.type, hour);
  const secondChiller = lf > 0.65;
  return points.map((pt) => {
    const pf = faults.point.get(pt.id);
    let value = pt.value;
    if (pt.kind === "status") {
      if (pt.system === "AHU" || pt.system === "FCU") value = scheduled ? 1 : 0;
      else if (pt.equipment === "Chiller-2" || pt.equipment === "CHWP-2") value = secondChiller ? 1 : 0;
      else value = 1;
    } else if (pf?.has("filter-dp")) {
      value = value + (290 - value) * 0.2 + (Math.random() - 0.5) * 3;
    } else if (pf?.has("zone-hot") && pt.setpoint !== undefined) {
      value = value + (pt.setpoint + 3.8 - value) * 0.2 + (Math.random() - 0.5) * 0.05;
    } else {
      // Ease back to the seeded base with gentle noise (±1–3 % feel).
      const spread = pt.unit === "Pa" ? 2 : 0.05;
      value = value + (pt.base - value) * 0.2 + (Math.random() - 0.5) * spread;
    }
    return { ...pt, value, updatedAt: now };
  });
}

// ---- Random minor events (CLAUDE.md §7) -------------------------------------------------

const MINOR_KINDS: { kind: FaultKind; weight: number }[] = [
  { kind: "low-pf", weight: 3 },
  { kind: "imbalance", weight: 3 },
  { kind: "panel-hot", weight: 2 },
  { kind: "filter-dp", weight: 2 },
  { kind: "zone-hot", weight: 2 },
  { kind: "voltage-low", weight: 1 },
  { kind: "panel-offline", weight: 1 },
  { kind: "overload", weight: 1 },
  { kind: "feeder-trip", weight: 0.5 },
];

function randomFault(s: SimData, now: number, id: string): Fault | null {
  const r = Math.random;
  const total = MINOR_KINDS.reduce((a, k) => a + k.weight, 0);
  let roll = r() * total;
  const kind = MINOR_KINDS.find((k) => (roll -= k.weight) < 0)?.kind ?? "low-pf";
  const b = pick(r, BUILDINGS);
  const ev = CONFIG.minorEvents;
  const base = { id, kind, buildingId: b.id, startedAt: now, endsAt: now + between(r, ev.minDurationS, ev.maxDurationS) * 1000 };

  if (kind === "filter-dp" || kind === "zone-hot") {
    const pts = s.bmsPoints[b.id].filter((p) => (kind === "filter-dp" ? p.name === "Filter ΔP" : p.system === "Zone"));
    return { ...base, pointId: pick(r, pts).id };
  }
  const panelId = pick(r, s.panelIds[b.id]);
  if (kind === "panel-hot" || kind === "voltage-low" || kind === "panel-offline") return { ...base, panelId };
  const panel = s.panels[panelId];
  const candidates = panel.feeders.filter((f) => f.kw > 2);
  if (!candidates.length) return null;
  return { ...base, panelId, feederId: pick(r, candidates).id };
}

// ---- Work orders -------------------------------------------------------------------------

function tradeFor(c: Pick<Condition, "source" | "type">): Trade {
  if (c.source === "predictive") return "Mechanical";
  if (c.source === "bms") return c.type === "filter-dirty" ? "HVAC" : "BMS";
  return "Electrical";
}

/** Least-busy technician of the right trade. */
export function assignTechnician(s: Pick<SimData, "technicians" | "workOrders">, trade: Trade): string {
  const load = new Map<string, number>();
  for (const w of s.workOrders) if (w.status !== "closed") load.set(w.technicianId, (load.get(w.technicianId) ?? 0) + 1);
  const pool = s.technicians.filter((t) => t.trade === trade);
  const list = pool.length ? pool : s.technicians;
  return [...list].sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0))[0].id;
}

/** Simulated pickup delay, shortened for a live demo. */
function plannedResponse(priority: Priority, now: number): number {
  const [min, max] = priority === "P1" ? [20, 60] : priority === "P2" ? [40, 120] : [60, 240];
  return now + between(Math.random, min, max) * 1000;
}

export function newWorkOrder(
  s: Pick<SimData, "technicians" | "workOrders">,
  seq: number,
  input: { buildingId: string; priority: Priority; title: string; trade: Trade; alarmId?: string; autoCreated: boolean },
  now: number,
): WorkOrder {
  return {
    id: `WO-${seq}`,
    alarmId: input.alarmId,
    buildingId: input.buildingId,
    priority: input.priority,
    title: input.title,
    technicianId: assignTechnician(s, input.trade),
    status: "open",
    createdAt: now,
    slaDueAt: now + CONFIG.slaMinutes[input.priority] * MINUTE,
    plannedResponseAt: plannedResponse(input.priority, now),
    autoCreated: input.autoCreated,
  };
}

// ---- Tick --------------------------------------------------------------------------------

export function advance(s: SimData, now: number): SimData {
  const dt = clamp(now - s.now, 0, 10_000);
  const newDay = dubaiDayStart(now) !== dubaiDayStart(s.now);
  const hour = dubaiHour(now);
  const seq = { ...s.seq };

  // 1. Faults: expire old ones, maybe start a new minor event.
  let faults = s.faults.filter((f) => f.endsAt > now);
  let nextMinorAt = s.nextMinorAt;
  if (now >= s.nextMinorAt) {
    const f = randomFault(s, now, `F-${seq.fault + 1}`);
    if (f) {
      seq.fault++;
      faults = [...faults, f];
    }
    const ev = CONFIG.minorEvents;
    nextMinorAt = now + between(Math.random, ev.minIntervalS, ev.maxIntervalS) * 1000;
  }
  const fi = indexFaults(faults);

  // 2. Live electrical and BMS values.
  const panels: SimData["panels"] = {};
  const bmsPoints: SimData["bmsPoints"] = {};
  for (const b of Object.values(s.buildings)) {
    const lf = loadFactor(b.info.type, hour);
    const kw = buildingKwAt(b.info.id, b.info.type, b.peakKw, now) * jitter(0.01);
    for (const id of s.panelIds[b.info.id]) {
      let p = s.panels[id];
      if (newDay) p = { ...p, feeders: p.feeders.map((f) => ({ ...f, kwhToday: 0 })) };
      panels[id] = updatePanel(p, kw, lf, dt, now, fi);
    }
    bmsPoints[b.info.id] = updateBms(s.bmsPoints[b.info.id], b, hour, lf, now, fi);
  }

  // 3. Rules → conditions.
  const activeByKey = new Map(s.alarms.filter(isOpen).map((a) => [a.key, a]));
  const wasActive = (k: string) => activeByKey.has(k);
  const conditions: Condition[] = [];
  for (const p of Object.values(panels)) conditions.push(...panelConditions(p, wasActive));
  for (const pts of Object.values(bmsPoints)) conditions.push(...bmsConditions(pts, wasActive));
  for (const a of Object.values(s.assets)) conditions.push(...assetConditions(a, wasActive));
  const condByKey = new Map(conditions.map((c) => [c.key, c]));

  // 4. Alarms: clear what resolved, raise what's new (each new alarm opens a work order).
  let workOrders = s.workOrders;
  const raised: Alarm[] = [];
  const newOrders: WorkOrder[] = [];
  for (const c of conditions) {
    if (activeByKey.has(c.key)) continue;
    const alarmId = `AL-${++seq.alarm}`;
    const wo = newWorkOrder(
      { technicians: s.technicians, workOrders: [...newOrders, ...workOrders] },
      ++seq.workOrder,
      { buildingId: c.buildingId, priority: c.priority, title: c.title, trade: tradeFor(c), alarmId, autoCreated: true },
      now,
    );
    newOrders.push(wo);
    raised.push({ ...c, id: alarmId, raisedAt: now, status: "active", workOrderId: wo.id });
  }
  let alarms = [
    ...raised.reverse(),
    ...s.alarms.map((a) => {
      if (!isOpen(a)) return a;
      const c = condByKey.get(a.key);
      // Still active: keep the reading in the detail current. Gone: clear it.
      return c ? (c.detail === a.detail ? a : { ...a, detail: c.detail }) : { ...a, status: "cleared" as const, clearedAt: now };
    }),
  ];
  const cleared = alarms.filter((a) => !isOpen(a));
  if (cleared.length > MAX_CLEARED_ALARMS) {
    const drop = new Set(cleared.slice(MAX_CLEARED_ALARMS).map((a) => a.id));
    alarms = alarms.filter((a) => !drop.has(a.id));
  }

  // 5. Work-order progression: technician picks up, closes once the alarm has cleared.
  const alarmById = new Map(alarms.map((a) => [a.id, a]));
  workOrders = [...newOrders.reverse(), ...workOrders].map((w) => {
    if (w.status === "open" && w.plannedResponseAt !== undefined && now >= w.plannedResponseAt) {
      return { ...w, status: "in_progress" as const, respondedAt: now };
    }
    if (w.status === "in_progress" && w.alarmId) {
      const a = alarmById.get(w.alarmId);
      if (a && a.status === "cleared" && a.clearedAt !== undefined && now - a.clearedAt > 15_000) {
        return { ...w, status: "closed" as const, closedAt: now };
      }
    }
    return w;
  });

  // 6. Building roll-ups.
  const openByBuilding = new Map<string, Alarm[]>();
  for (const a of alarms) if (isOpen(a)) openByBuilding.set(a.buildingId, [...(openByBuilding.get(a.buildingId) ?? []), a]);
  const dayOfMonth = dubaiDayOfMonth(now);

  const buildings: SimData["buildings"] = {};
  for (const b of Object.values(s.buildings)) {
    const ps = s.panelIds[b.info.id].map((id) => panels[id]);
    const kw = ps.reduce((a, p) => a + p.incomer.kw, 0);
    const kwhToday = ps.reduce((a, p) => a + p.incomer.kwhToday, 0);
    const open = (openByBuilding.get(b.info.id) ?? []).sort(
      (x, y) => PRIORITY_RANK[x.priority] - PRIORITY_RANK[y.priority] || y.raisedAt - x.raisedAt,
    );
    const offline = ps.filter((p) => p.status === "offline").length;
    const health = clamp(100 - open.reduce((a, x) => a + HEALTH_PENALTY[x.priority], 0) - offline * 5, 15, 100);
    const status: HealthStatus = offline === ps.length ? "offline" : open.some((x) => x.priority === "P1") || health < 60 ? "alarm" : open.length || health < 85 ? "warning" : "online";
    buildings[b.info.id] = {
      ...b,
      kw,
      kwhToday,
      costTodayAed: kwhToday * b.rateAedPerKwh,
      openAlarms: open.length,
      health,
      status,
      topIssue: open[0]?.title,
      manualReadingsAvoided: ps.length * CONFIG.manualRoundsPerPanelPerDay * dayOfMonth,
      bms: { ...b.bms, lastSyncAt: now - Math.round(Math.random() * 3) * 1000 },
      updatedAt: now,
    };
  }

  return { ...s, now, buildings, panels, bmsPoints, alarms, workOrders, faults, nextMinorAt, seq };
}
