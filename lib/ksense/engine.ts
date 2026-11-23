// K-Sense cold-chain tick: a pure function from (state, time) to the next state. Chambers drift
// around their setpoint, doors open and close, freezers defrost, the scripted incident bends the
// readings, and rules turn readings into alarms and excursions.

import type { Priority } from "../config";
import { fmtNum, fmtTemp } from "../format";
import { DAY, MINUTE } from "../sim/generators";
import { between, clamp, jitter, pick, rngFor } from "../sim/random";
import { BANDS, KSENSE, UNIT_BASE } from "./config";
import { defrostHold, historicTemp, inDefrost } from "./history";
import { COLD_INCIDENT, incidentDoorOpen, incidentSuction, incidentTemp } from "./scenario";
import { CHAMBER_TEMPLATES } from "./sites";
import type { Chamber, ColdAlarm, ColdAlarmType, ColdFaults, Excursion } from "./types";

export interface ColdData {
  ready: boolean;
  now: number;
  chambers: Record<string, Chamber>;
  /** Chamber ids in portfolio order (site by site). */
  chamberIds: string[];
  /** Newest first. */
  alarms: ColdAlarm[];
  /** Newest first. */
  excursions: Excursion[];
  faults: ColdFaults;
  nextDoorEventAt: number;
  seq: { alarm: number; excursion: number };
  incident: { startedAt: number } | null;
}

export const EMPTY_COLD: ColdData = {
  ready: false,
  now: 0,
  chambers: {},
  chamberIds: [],
  alarms: [],
  excursions: [],
  faults: { reliefIced: [], doorUntil: {} },
  nextDoorEventAt: 0,
  seq: { alarm: 0, excursion: 0 },
  incident: null,
};

export const isColdOpen = (a: ColdAlarm) => a.status !== "cleared";

const fmtAedShort = (v: number) => (v >= 1_000_000 ? `AED ${fmtNum(v / 1_000_000, 1)}M` : `AED ${fmtNum(Math.round(v / 1_000))}k`);
const fmtBar = (v: number) => `${fmtNum(v, 1)} bar`;

interface Condition {
  key: string;
  chamberId: string;
  siteId: string;
  type: ColdAlarmType;
  priority: Priority;
  predictive: boolean;
  title: string;
  detail: string;
}

function conditionsFor(c: Chamber, now: number, wasActive: (k: string) => boolean): Condition[] {
  const band = BANDS[c.type];
  const base = UNIT_BASE[c.type];
  const t = KSENSE.thresholds;
  const out: Condition[] = [];
  const add = (type: ColdAlarmType, priority: Priority, title: string, detail: string, predictive = false) =>
    out.push({ key: `${c.id}:${type}`, chamberId: c.id, siteId: c.siteId, type, priority, predictive, title, detail });
  const critical = c.type === "frozen" || c.type === "pharma";

  const highKey = `${c.id}:temp-high`;
  if ((c.tempC > band.highC && !defrostHold(c, now)) ||(wasActive(highKey) && c.tempC > band.highC - t.excursionHysteresisC)) {
    add("temp-high", critical ? "P1" : "P2", "Temperature out of range", `${fmtTemp(c.tempC)} · limit ${band.highC} °C · ${fmtAedShort(c.stockAed)} of stock at risk`);
  }
  const lowKey = `${c.id}:temp-low`;
  if (c.type !== "frozen" && (c.tempC < band.lowC || (wasActive(lowKey) && c.tempC < band.lowC + t.excursionHysteresisC))) {
    add("temp-low", c.type === "pharma" ? "P1" : "P3", "Too cold", `${fmtTemp(c.tempC)} · lower limit ${band.lowC} °C · risk of freezing the stock`);
  }
  if (c.doorOpen && c.doorOpenSince !== undefined && now - c.doorOpenSince >= t.doorOpenAlarmS * 1000) {
    add("door-open", "P2", "Door open too long", `Open ${fmtNum((now - c.doorOpenSince) / 1000)} s · warm air is getting in`);
  }
  const leakKey = `${c.id}:refrigerant-leak`;
  const leakLimit = (base.suctionBar * (wasActive(leakKey) ? t.suctionLowClearPct : t.suctionLowPct)) / 100;
  if (c.unit.running && c.unit.suctionBar < leakLimit) {
    const harder = Math.max(0, (c.unit.kw / base.kw - 1) * 100);
    add(
      "refrigerant-leak",
      "P2",
      "Possible refrigerant leak",
      `Suction ${fmtBar(c.unit.suctionBar)} (normal ${fmtBar(base.suctionBar)}), compressor working ${fmtNum(harder)}% harder. Room still in range: inspect before stock is at risk.`,
      true,
    );
  }
  if (c.unit.dischargeBar > t.dischargeHighBar) {
    add("discharge-high", "P2", "Condenser struggling", `Discharge ${fmtBar(c.unit.dischargeBar)} (limit ${t.dischargeHighBar} bar): clean the condenser coil, check the fans`, true);
  }
  if (!c.doorOpen && c.roomPa < t.reliefStuckPa && (c.doorClosedAt === undefined || now - c.doorClosedAt > t.reliefStuckS * 1000)) {
    add("relief-iced", "P3", "Pressure relief port iced", `Room at ${fmtNum(c.roomPa)} Pa with the door shut: door hard to open, panels under strain. Clear the relief port.`);
  }
  if (c.sensor.batteryPct < t.lowBatteryPct) {
    add("battery-low", "P3", "Sensor battery low", `K-Sense sensor at ${fmtNum(c.sensor.batteryPct)}%: replace at the next visit`);
  }
  return out;
}

function updateChamber(c: Chamber, now: number, s: ColdData, elapsedS: number | undefined): Chamber {
  const band = BANDS[c.type];
  const base = UNIT_BASE[c.type];
  const defrosting = inDefrost(c, now);
  const isDoorIncident = elapsedS !== undefined && c.id === COLD_INCIDENT.doorChamberId;
  const isLeakIncident = elapsedS !== undefined && c.id === COLD_INCIDENT.leakChamberId;
  const doorOpen = (isDoorIncident && incidentDoorOpen(elapsedS)) || (s.faults.doorUntil[c.id] ?? 0) > now;
  const justClosed = !doorOpen && c.doorOpen;

  // Temperature eases toward its target; an open door lets warm dock air in.
  let target = band.setpointC + c.offsetC;
  if (defrosting) target = KSENSE.defrost.airTempC;
  if (doorOpen) target = c.type === "frozen" ? -2 : band.setpointC + 10;
  let tempC = c.tempC + (target - c.tempC) * (doorOpen ? 0.05 : 0.15) + (Math.random() - 0.5) * 0.1;
  const scripted = isDoorIncident ? incidentTemp(elapsedS) : undefined;
  if (scripted !== undefined) tempC = scripted + (Math.random() - 0.5) * 0.08;

  const rhPct = clamp(c.rhPct + (band.rhPct + (doorOpen ? 8 : 0) - c.rhPct) * 0.2 + (Math.random() - 0.5) * 0.6, 20, 99);

  // Room differential pressure: a freezer pulls a vacuum when the door shuts, the relief port lets it settle.
  const iced = s.faults.reliefIced.includes(c.id);
  const paTarget = c.type === "frozen" ? (iced ? KSENSE.roomPa.iced : KSENSE.roomPa.freezerSettled) : c.type === "pharma" ? KSENSE.roomPa.pharmaPositive : 0;
  let roomPa: number;
  if (doorOpen) roomPa = (Math.random() - 0.5) * 1.5;
  else if (justClosed && c.type === "frozen") roomPa = iced ? KSENSE.roomPa.iced : KSENSE.roomPa.freezerAfterClose;
  else roomPa = c.roomPa + (paTarget - c.roomPa) * 0.25 + (Math.random() - 0.5) * 0.8;

  // Refrigeration unit: compressor stops during defrost; an open door makes it work harder.
  const running = !defrosting;
  let suctionBar = running
    ? c.unit.suctionBar + (base.suctionBar * (doorOpen ? 1.06 : 1) - c.unit.suctionBar) * 0.3 + (Math.random() - 0.5) * 0.02 * base.suctionBar
    : c.unit.suctionBar + (base.suctionBar * 1.5 - c.unit.suctionBar) * 0.2;
  let leakLoad = 1;
  const leaked = isLeakIncident ? incidentSuction(elapsedS) : undefined;
  if (leaked !== undefined) {
    suctionBar = leaked + (Math.random() - 0.5) * 0.02;
    const { from, to } = COLD_INCIDENT.leak;
    leakLoad = 1 + 0.18 * clamp((from - leaked) / (from - to), 0, 1);
    // Working harder, the room just holds, drifting a little toward the top of the band.
    tempC = c.tempC + (band.setpointC + 1.1 * (leakLoad - 1) / 0.18 - c.tempC) * 0.15 + (Math.random() - 0.5) * 0.06;
  }
  const dischargeBar = c.unit.dischargeBar + (base.dischargeBar + (doorOpen ? 0.8 : 0) - c.unit.dischargeBar) * 0.3 + (Math.random() - 0.5) * 0.15;
  const kw = running ? base.kw * (doorOpen ? 1.15 : 1) * leakLoad * jitter(0.02) : 0.3 * jitter(0.05);

  const recent = [...c.recent, { t: now, c: tempC }];
  if (recent.length > KSENSE.recentPoints) recent.splice(0, recent.length - KSENSE.recentPoints);

  return {
    ...c,
    tempC,
    rhPct,
    doorOpen,
    doorOpenSince: doorOpen ? (c.doorOpen ? c.doorOpenSince : now) : undefined,
    doorClosedAt: justClosed ? now : c.doorClosedAt,
    roomPa,
    defrosting,
    unit: { ...c.unit, suctionBar, dischargeBar, kw, running },
    sensor: { ...c.sensor, lastSeenAt: now },
    recent,
    updatedAt: now,
  };
}

export function advanceCold(s: ColdData, now: number): ColdData {
  const seq = { ...s.seq };
  const elapsedS = s.incident ? (now - s.incident.startedAt) / 1000 : undefined;

  // 1. Random short door openings (normal dock work).
  const doorUntil: Record<string, number> = {};
  for (const [id, until] of Object.entries(s.faults.doorUntil)) if (until > now) doorUntil[id] = until;
  let nextDoorEventAt = s.nextDoorEventAt;
  if (now >= s.nextDoorEventAt) {
    const candidates = s.chamberIds.filter((id) => !doorUntil[id] && !s.chambers[id].defrosting && !(s.incident && id === COLD_INCIDENT.doorChamberId));
    if (candidates.length) {
      const ev = KSENSE.doorEvents;
      doorUntil[pick(Math.random, candidates)] = now + between(Math.random, ev.minOpenS, ev.maxOpenS) * 1000;
    }
    nextDoorEventAt = now + between(Math.random, KSENSE.doorEvents.minIntervalS, KSENSE.doorEvents.maxIntervalS) * 1000;
  }
  const faults: ColdFaults = { ...s.faults, doorUntil };
  const next: ColdData = { ...s, faults };

  // 2. Live readings.
  const chambers: Record<string, Chamber> = {};
  for (const id of s.chamberIds) chambers[id] = updateChamber(s.chambers[id], now, next, elapsedS);

  // 3. Rules → alarms.
  const activeByKey = new Map(s.alarms.filter(isColdOpen).map((a) => [a.key, a]));
  const conditions = s.chamberIds.flatMap((id) => conditionsFor(chambers[id], now, (k) => activeByKey.has(k)));
  const condByKey = new Map(conditions.map((c) => [c.key, c]));

  const raised: ColdAlarm[] = [];
  let excursions = s.excursions;
  for (const c of conditions) {
    if (activeByKey.has(c.key)) continue;
    raised.push({ ...c, id: `KS-${++seq.alarm}`, raisedAt: now, status: "active" });
    if (c.type === "temp-high" || c.type === "temp-low") {
      const ch = chambers[c.chamberId];
      const band = BANDS[ch.type];
      excursions = [
        {
          id: `EX-${++seq.excursion}`,
          chamberId: c.chamberId,
          siteId: c.siteId,
          startedAt: now,
          peakC: ch.tempC,
          limitC: c.type === "temp-high" ? band.highC : band.lowC,
          cause: ch.doorOpen ? "Door left open" : "Under investigation",
        },
        ...excursions,
      ];
    }
  }
  const alarms = [
    ...raised.reverse(),
    ...s.alarms.map((a) => {
      if (!isColdOpen(a)) return a;
      const c = condByKey.get(a.key);
      return c ? (c.detail === a.detail ? a : { ...a, detail: c.detail }) : { ...a, status: "cleared" as const, clearedAt: now };
    }),
  ].slice(0, 200);

  // 4. Excursions: track the peak while open, close when the temperature alarm clears.
  excursions = excursions.map((e) => {
    if (e.endedAt !== undefined) return e;
    const ch = chambers[e.chamberId];
    const high = e.limitC === BANDS[ch.type].highC;
    const open = condByKey.has(`${e.chamberId}:${high ? "temp-high" : "temp-low"}`);
    const peakC = high ? Math.max(e.peakC, ch.tempC) : Math.min(e.peakC, ch.tempC);
    return open ? (peakC === e.peakC ? e : { ...e, peakC }) : { ...e, peakC, endedAt: now };
  });

  return { ...next, now, chambers, alarms, excursions, nextDoorEventAt, seq };
}

// ---- Initial state ------------------------------------------------------------------------

/** Excursions in the last 30 days, so the log and time-in-range have history. */
const PAST_EXCURSIONS: { chamber: string; daysAgo: number; durMin: number; peakC: number; cause: string }[] = [
  { chamber: "jebel-ali:FR-01", daysAgo: 2.3, durMin: 14, peakC: -15.8, cause: "Door left open during loading" },
  { chamber: "sharjah:FR-01", daysAgo: 5.6, durMin: 38, peakC: -14.2, cause: "Power cut, genset changeover" },
  { chamber: "al-quoz:CH-01", daysAgo: 8.1, durMin: 9, peakC: 5.1, cause: "Door left open during loading" },
  { chamber: "dip:FR-03", daysAgo: 11.4, durMin: 22, peakC: -16.9, cause: "Defrost overran" },
  { chamber: "jebel-ali:CH-02", daysAgo: 15.2, durMin: 11, peakC: 4.8, cause: "Door left open during loading" },
  { chamber: "kizad:PH-01", daysAgo: 19.7, durMin: 6, peakC: 8.4, cause: "Compressor short-cycling, fixed same day" },
  { chamber: "al-quoz:PR-01", daysAgo: 24.3, durMin: 17, peakC: 15.2, cause: "Warm produce loaded in" },
  { chamber: "dip:FR-01", daysAgo: 27.9, durMin: 26, peakC: -15.1, cause: "Condenser fan fault" },
];

const BATTERY_OVERRIDES: Record<string, number> = { "sharjah:CH-01": 12 };
const STARTING_RELIEF_ICED = ["dip:FR-02"];

export function createColdState(now: number): ColdData {
  const chambers: Record<string, Chamber> = {};
  const chamberIds: string[] = [];
  const unitNo: Record<string, number> = {};
  for (const tpl of CHAMBER_TEMPLATES) {
    const id = `${tpl.site}:${tpl.name}`;
    const r = rngFor("ksense", id);
    const band = BANDS[tpl.type];
    const base = UNIT_BASE[tpl.type];
    unitNo[tpl.site] = (unitNo[tpl.site] ?? 0) + 1;
    const seed = { id, type: tpl.type, offsetC: between(r, -0.6, 0.6), defrostPhaseMs: r() * KSENSE.defrost.everyH * 3_600_000 };
    const tempC = historicTemp(seed, now);
    chambers[id] = {
      ...seed,
      siteId: tpl.site,
      name: tpl.name,
      product: tpl.product,
      pallets: tpl.pallets,
      stockAed: tpl.stockAed,
      tempC,
      rhPct: band.rhPct + between(r, -3, 3),
      doorOpen: false,
      roomPa: tpl.type === "pharma" ? KSENSE.roomPa.pharmaPositive : 0,
      defrosting: inDefrost(seed, now),
      unit: { name: `CU-${String(unitNo[tpl.site]).padStart(2, "0")}`, suctionBar: base.suctionBar, dischargeBar: base.dischargeBar, kw: base.kw, running: true },
      sensor: { batteryPct: Math.round(BATTERY_OVERRIDES[id] ?? between(r, 55, 98)), signal: r() > 0.8 ? "fair" : "good", lastSeenAt: now },
      recent: [],
      updatedAt: now,
    };
    chamberIds.push(id);
  }

  const excursions: Excursion[] = PAST_EXCURSIONS.map((e, i) => {
    const ch = chambers[e.chamber];
    const band = BANDS[ch.type];
    const startedAt = now - e.daysAgo * DAY;
    return {
      id: `EX-${100 + PAST_EXCURSIONS.length - i}`,
      chamberId: e.chamber,
      siteId: ch.siteId,
      startedAt,
      endedAt: startedAt + e.durMin * MINUTE,
      peakC: e.peakC,
      limitC: e.peakC > band.highC ? band.highC : band.lowC,
      cause: e.cause,
    };
  });

  let state: ColdData = {
    ...EMPTY_COLD,
    ready: true,
    now,
    chambers,
    chamberIds,
    excursions,
    faults: { reliefIced: STARTING_RELIEF_ICED, doorUntil: {} },
    nextDoorEventAt: now + 4_000,
    seq: { alarm: 310, excursion: 100 + PAST_EXCURSIONS.length },
  };
  // Settle live values without moving the clock; back-date the starting alarms.
  for (let n = 0; n < 12; n++) state = advanceCold(state, now);
  return { ...state, alarms: state.alarms.map((a) => ({ ...a, raisedAt: now - (a.type === "relief-iced" ? 52 : 180) * MINUTE })) };
}
