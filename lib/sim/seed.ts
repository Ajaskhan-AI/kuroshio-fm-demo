// Builds the starting state of the simulation. Everything structural is seeded from ids,
// so the portfolio (panels, ratings, asset health, history) is identical on every reload.

import { BUILDINGS, type BuildingInfo } from "../buildings";
import { CONFIG, type Priority } from "../config";
import { blendedRateAedPerKwh } from "../tariff";
import type {
  Asset,
  AssetType,
  BmsPoint,
  BmsSystem,
  BuildingLive,
  Fault,
  FaultKind,
  Feeder,
  FeederCategory,
  Panel,
  Technician,
  Triple,
  WorkOrder,
} from "../types";
import { estimateDaysToFailure, recommendationFor } from "./assets";
import { advance } from "./engine";
import { DAY, HOUR, MINUTE, kwhSinceMidnight, typicalMonthlyKwh } from "./generators";
import { between, clamp, pick, rngFor, type Rng } from "./random";
import { EMPTY_SIM, type SimData } from "./state";

/** Design peak load per building, kW (300–1,200 kW range, CLAUDE.md §7). */
const PEAK_KW: Record<string, number> = {
  "marina-a": 950,
  "bb-plaza": 1_100,
  "deira-annex": 1_200,
  "jlt-one": 800,
  "reem-res": 650,
  "sharjah-hub": 450,
};

interface PanelTemplate {
  name: string;
  location: string;
  share: number;
  feeders: [string, FeederCategory][];
}

// Cooling (chillers, AHUs, FCUs, pumps) ends up ≈ 60–70 % of building load.
const PANELS: PanelTemplate[] = [
  { name: "SMDB-01", location: "Basement plant room", share: 0.3, feeders: [["Chiller-1", "cooling"], ["Chiller-2", "cooling"], ["CHW pumps", "pumps"], ["Condenser pumps", "pumps"]] },
  { name: "SMDB-02", location: "Roof plant", share: 0.18, feeders: [["AHU-1", "cooling"], ["AHU-2", "cooling"], ["AHU-3", "cooling"], ["Exhaust fans", "ventilation"]] },
  { name: "SMDB-03", location: "Ground floor", share: 0.1, feeders: [["Lighting GF", "lighting"], ["Small power GF", "power"], ["Lifts 1–2", "lifts"], ["Lobby FCUs", "cooling"]] },
  { name: "SMDB-04", location: "Level 5", share: 0.08, feeders: [["FCUs L1–5", "cooling"], ["Lighting L1–5", "lighting"], ["Small power L1–5", "power"]] },
  { name: "SMDB-05", location: "Level 10", share: 0.08, feeders: [["FCUs L6–10", "cooling"], ["Lighting L6–10", "lighting"], ["Small power L6–10", "power"]] },
  { name: "SMDB-06", location: "Level 15", share: 0.08, feeders: [["FCUs L11–15", "cooling"], ["Lighting L11–15", "lighting"], ["Small power L11–15", "power"]] },
  { name: "SMDB-07", location: "Level 20", share: 0.08, feeders: [["FCUs L16–20", "cooling"], ["Lighting L16–20", "lighting"], ["Small power L16–20", "power"]] },
  { name: "SMDB-08", location: "Car park", share: 0.1, feeders: [["Car park lighting", "lighting"], ["Ventilation fans", "ventilation"], ["EV chargers", "ev"], ["Sump pumps", "pumps"]] },
];

const CATEGORY_WEIGHT: Record<FeederCategory, number> = {
  cooling: 3,
  pumps: 1.5,
  ventilation: 1,
  lighting: 0.8,
  power: 1,
  lifts: 0.8,
  ev: 1.2,
};

const BREAKERS = [32, 40, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630];

/** Breaker sized so the feeder's peak current sits at ~70 % of rating. */
function breakerFor(peakKw: number): number {
  const peakA = (peakKw * 1000) / (Math.sqrt(3) * CONFIG.electrical.voltageLL * 0.92);
  return BREAKERS.find((b) => b >= peakA / 0.7) ?? BREAKERS[BREAKERS.length - 1];
}

function seedPanels(b: BuildingInfo, peakKw: number, now: number): Panel[] {
  return PANELS.map((tpl) => {
    const r = rngFor(b.id, tpl.name);
    const id = `${b.id}:${tpl.name}`;
    const weights = tpl.feeders.map(([, cat]) => CATEGORY_WEIGHT[cat] * between(r, 0.8, 1.2));
    const total = weights.reduce((a, c) => a + c, 0);
    const vBase = between(r, 228, 233);
    const feeders: Feeder[] = tpl.feeders.map(([name, category], i) => {
      const share = weights[i] / total;
      const skew: Triple = [1 + between(r, -0.03, 0.03), 1 + between(r, -0.03, 0.03), 1 + between(r, -0.03, 0.03)];
      return {
        id: `${id}:F${i + 1}`,
        panelId: id,
        name,
        category,
        ratedA: breakerFor(peakKw * tpl.share * share),
        share,
        pfBase: between(r, 0.88, 0.97),
        phaseSkew: skew,
        v: [vBase, vBase, vBase],
        i: [0, 0, 0],
        pf: 0.92,
        kw: 0,
        kwhToday: kwhSinceMidnight(b.id, b.type, peakKw, now) * tpl.share * share,
        tripped: false,
      };
    });
    const baseTempC = between(r, 30, 36);
    return {
      id,
      buildingId: b.id,
      name: tpl.name,
      location: tpl.location,
      share: tpl.share,
      baseTempC,
      vBase,
      status: "online",
      tempC: baseTempC + 3,
      feeders,
      incomer: { v: [vBase, vBase, vBase], i: [0, 0, 0], pf: 0.92, kw: 0, kwhToday: 0 },
      updatedAt: now,
    };
  });
}

function seedBms(b: BuildingInfo, now: number): BmsPoint[] {
  const r = rngFor(b.id, "bms");
  const pts: BmsPoint[] = [];
  const add = (system: BmsSystem, equipment: string, name: string, kind: BmsPoint["kind"], base: number, unit: string, setpoint?: number) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    pts.push({ id: `${b.id}:${equipment}:${slug}`, buildingId: b.id, system, equipment, name, kind, value: base, unit, base, setpoint, updatedAt: now });
  };
  for (let n = 1; n <= 4; n++) {
    const ahu = `AHU-${n}`;
    add("AHU", ahu, "Supply air temp", "analog", between(r, 13.2, 14.8), "°C", 14);
    add("AHU", ahu, "Return air temp", "analog", between(r, 23, 24.5), "°C");
    add("AHU", ahu, "Fan status", "status", 1, "");
    add("AHU", ahu, "Filter ΔP", "analog", between(r, 120, 200), "Pa");
  }
  for (let n = 1; n <= 2; n++) {
    const ch = `Chiller-${n}`;
    add("Chiller", ch, "Status", "status", 1, "");
    add("Chiller", ch, "CHW supply temp", "analog", between(r, 6.2, 6.9), "°C", 6.5);
    add("Chiller", ch, "CHW return temp", "analog", between(r, 12.1, 12.9), "°C");
  }
  add("Pump", "CHWP-1", "Status", "status", 1, "");
  add("Pump", "CHWP-2", "Status", "status", 1, "");
  for (const g of ["L1–5", "L6–10", "L11–15", "L16–20"]) add("FCU", `FCU group ${g}`, "Status", "status", 1, "");
  for (const z of ["GF lobby", "Level 5", "Level 10", "Level 15"]) add("Zone", `Zone ${z}`, "Zone temp", "analog", between(r, 22.4, 23.8), "°C", 23);
  return pts;
}

const ASSET_TEMPLATES: { name: string; type: AssetType; location: string }[] = [
  { name: "CHWP-1", type: "Chilled water pump", location: "Basement plant room" },
  { name: "CHWP-2", type: "Chilled water pump", location: "Basement plant room" },
  { name: "CDWP-1", type: "Condenser pump", location: "Basement plant room" },
  { name: "AHU-1 fan", type: "AHU fan", location: "Roof plant" },
  { name: "AHU-2 fan", type: "AHU fan", location: "Roof plant" },
];

/** Fixed starting health for assets the demo story relies on. */
const HEALTH_OVERRIDES: Record<string, number> = {
  "bb-plaza:AHU-2 fan": 66,
  "marina-a:CHWP-2": 84,
};

function seedAssets(b: BuildingInfo): Asset[] {
  return ASSET_TEMPLATES.map((tpl) => {
    const r = rngFor(b.id, tpl.name, "asset");
    const key = `${b.id}:${tpl.name}`;
    const health = Math.round(HEALTH_OVERRIDES[key] ?? between(r, 82, 97));
    const degrading = health < 80;
    const start = degrading ? health + between(r, 14, 20) : health + between(r, -2, 3);
    const healthHistory = Array.from({ length: 30 }, (_, d) => {
      const lin = start + ((health - start) * d) / 29;
      return clamp(Math.round((lin + between(r, -1, 1)) * 10) / 10, 0, 100);
    });
    healthHistory[29] = health;
    const signatureHistory = healthHistory.map((h) => Math.round(((100 - h) / 10 + between(r, -0.15, 0.15)) * 100) / 100);
    const daysToFailure = estimateDaysToFailure(health, healthHistory);
    return {
      id: key,
      buildingId: b.id,
      name: tpl.name,
      type: tpl.type,
      location: tpl.location,
      health,
      healthHistory,
      signatureHistory,
      daysToFailure,
      recommendation: recommendationFor(tpl.type, health, daysToFailure),
    };
  });
}

// Fictional technicians (CLAUDE.md §6.5).
export const TECHNICIANS: Technician[] = [
  { id: "t1", name: "Ravi Menon", trade: "Electrical" },
  { id: "t2", name: "Omar Haddad", trade: "Electrical" },
  { id: "t3", name: "Joel Fernandes", trade: "HVAC" },
  { id: "t4", name: "Bilal Siddiqui", trade: "HVAC" },
  { id: "t5", name: "Arun Pillai", trade: "BMS" },
  { id: "t6", name: "Samir Nasser", trade: "Mechanical" },
];

const HISTORY_TITLES: Record<Priority, string[]> = {
  P1: ["Panel overheating", "Feeder tripped", "Chiller tripped"],
  P2: ["Low voltage", "Feeder overloaded", "Panel offline", "Pump bearing wear"],
  P3: ["Low power factor", "Phase imbalance", "AHU filter dirty", "Zone too warm", "Panel running hot"],
};

/** 30 days of closed work orders per building, so SLA % and response times have history. */
function seedHistory(now: number, startSeq: number): { orders: WorkOrder[]; seq: number } {
  const orders: WorkOrder[] = [];
  let seq = startSeq;
  for (const b of BUILDINGS) {
    const r = rngFor(b.id, "wo-history");
    const count = Math.round(between(r, 20, 34));
    for (let n = 0; n < count; n++) {
      const roll = r();
      const priority: Priority = roll < 0.1 ? "P1" : roll < 0.45 ? "P2" : "P3";
      const slaMs = CONFIG.slaMinutes[priority] * MINUTE;
      const createdAt = now - between(r, 0.2, 30) * DAY;
      // ~2.5 % of jobs missed SLA: most sites on target, one or two just below, so the table has a story.
      const breach = r() < 0.025;
      const response = breach ? slaMs * between(r, 1.05, 1.5) : slaMs * between(r, 0.15, 0.9);
      const respondedAt = createdAt + response;
      const closedAt = respondedAt + between(r, 20 * MINUTE, 3 * HOUR);
      if (closedAt > now - 5 * MINUTE) continue;
      const tech = pick(r, TECHNICIANS);
      orders.push({
        id: `WO-${++seq}`,
        buildingId: b.id,
        priority,
        title: pick(r, HISTORY_TITLES[priority]),
        technicianId: tech.id,
        status: "closed",
        createdAt,
        slaDueAt: createdAt + slaMs,
        respondedAt,
        closedAt,
        autoCreated: true,
      });
    }
  }
  orders.sort((a, b) => b.createdAt - a.createdAt);
  // Renumber so ids increase with time.
  const n = orders.length;
  orders.forEach((o, i) => (o.id = `WO-${startSeq + n - i}`));
  return { orders, seq: startSeq + n };
}

/** A few conditions already running when the demo opens, so the portfolio isn't all green. */
const STARTING_FAULTS: { kind: FaultKind; building: string; panel?: string; feeder?: number; point?: string; minutesAgo: number; minutesLeft: number }[] = [
  { kind: "low-pf", building: "deira-annex", panel: "SMDB-01", feeder: 4, minutesAgo: 18, minutesLeft: 12 },
  { kind: "panel-hot", building: "sharjah-hub", panel: "SMDB-08", minutesAgo: 9, minutesLeft: 8 },
  { kind: "filter-dp", building: "jlt-one", point: "AHU-2:filter-p", minutesAgo: 42, minutesLeft: 20 },
  { kind: "imbalance", building: "reem-res", panel: "SMDB-05", feeder: 1, minutesAgo: 6, minutesLeft: 6 },
];

export function createInitialState(now: number): SimData {
  const buildings: Record<string, BuildingLive> = {};
  const panels: Record<string, Panel> = {};
  const panelIds: Record<string, string[]> = {};
  const bmsPoints: Record<string, BmsPoint[]> = {};
  const assets: Record<string, Asset> = {};

  for (const b of BUILDINGS) {
    const peakKw = PEAK_KW[b.id] ?? 600;
    const r: Rng = rngFor(b.id, "bms-meta");
    const ps = seedPanels(b, peakKw, now);
    ps.forEach((p) => (panels[p.id] = p));
    panelIds[b.id] = ps.map((p) => p.id);
    bmsPoints[b.id] = seedBms(b, now);
    seedAssets(b).forEach((a) => (assets[a.id] = a));
    buildings[b.id] = {
      info: b,
      peakKw,
      rateAedPerKwh: blendedRateAedPerKwh(typicalMonthlyKwh(b.type, peakKw)),
      kw: 0,
      kwhToday: 0,
      costTodayAed: 0,
      openAlarms: 0,
      health: 100,
      status: "online",
      manualReadingsAvoided: 0,
      bms: {
        protocol: "BACnet/IP",
        devicesDiscovered: Math.round(between(r, 38, 47)),
        pointsMapped: Math.round(between(r, 290, 340)),
        lastSyncAt: now,
        status: "online",
      },
      updatedAt: now,
    };
  }

  const faults: Fault[] = STARTING_FAULTS.map((f, i) => {
    const panelId = f.panel ? `${f.building}:${f.panel}` : undefined;
    return {
      id: `F-${i + 1}`,
      kind: f.kind,
      buildingId: f.building,
      panelId,
      feederId: panelId && f.feeder ? `${panelId}:F${f.feeder}` : undefined,
      pointId: f.point ? `${f.building}:${f.point}` : undefined,
      startedAt: now - f.minutesAgo * MINUTE,
      endsAt: now + f.minutesLeft * MINUTE,
    };
  });

  const history = seedHistory(now, 1000);

  let state: SimData = {
    ...EMPTY_SIM,
    ready: true,
    now,
    startedAt: now,
    buildings,
    panels,
    panelIds,
    bmsPoints,
    assets,
    workOrders: history.orders,
    technicians: TECHNICIANS,
    faults,
    // First random event shortly after the demo opens.
    nextMinorAt: now + 20_000,
    seq: { alarm: 2040, workOrder: history.seq, fault: faults.length },
  };

  // Settle live values (temperatures converge) without advancing the clock.
  for (let n = 0; n < 20; n++) state = advance(state, now);

  // Alarms from starting conditions began before the demo opened: back-date them.
  const ago = new Map(faults.map((f) => [f.buildingId, f.startedAt]));
  state = {
    ...state,
    alarms: state.alarms.map((a) => ({ ...a, raisedAt: ago.get(a.buildingId) ?? now - 2 * HOUR })),
    workOrders: state.workOrders.map((w) => {
      if (w.status === "closed" || !w.alarmId) return w;
      const created = ago.get(w.buildingId) ?? now - 2 * HOUR;
      const slaDueAt = created + CONFIG.slaMinutes[w.priority] * MINUTE;
      const picked = now - created > 5 * MINUTE;
      return {
        ...w,
        createdAt: created,
        slaDueAt,
        status: picked ? "in_progress" : w.status,
        respondedAt: picked ? created + Math.min(now - created, (slaDueAt - created) * 0.3) : undefined,
      };
    }),
  };
  return state;
}
