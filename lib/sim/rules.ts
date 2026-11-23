// Alarm rules: turn live values into alarm conditions. Thresholds come from CONFIG (§8).
// Each condition has a stable key; the engine raises an alarm when a key appears and clears it
// when the key disappears. `wasActive` applies hysteresis so values at a limit don't flap.

import { CONFIG, type Priority } from "../config";
import { fmtA, fmtNum, fmtPa, fmtPct, fmtPf, fmtTemp, fmtV } from "../format";
import type { AlarmSource, AlarmTarget, AlarmType, Asset, BmsPoint, Feeder, Panel } from "../types";

export interface Condition {
  key: string;
  buildingId: string;
  source: AlarmSource;
  priority: Priority;
  type: AlarmType;
  title: string;
  detail: string;
  target: AlarmTarget;
}

const T = CONFIG.thresholds;
const H = CONFIG.hysteresis;

export function imbalancePct(i: readonly number[]): number {
  const avg = (i[0] + i[1] + i[2]) / 3;
  if (avg <= 0) return 0;
  return (Math.max(...i.map((x) => Math.abs(x - avg))) / avg) * 100;
}

export function panelConditions(p: Panel, wasActive: (key: string) => boolean): Condition[] {
  const out: Condition[] = [];
  const base = { buildingId: p.buildingId, source: "meter" as const };
  const where = `${p.name} · ${p.location}`;

  if (p.status === "offline") {
    out.push({
      ...base,
      key: `${p.id}:offline`,
      priority: "P2",
      type: "panel-offline",
      title: "Panel offline",
      detail: `${where} · no data from the meter`,
      target: { panelId: p.id },
    });
    return out; // No fresh readings to judge anything else on.
  }

  // Temperature: alarm level replaces the warning so one panel never shows both.
  const alarmKey = `${p.id}:overheating`;
  const warnKey = `${p.id}:hot`;
  if (p.tempC > T.panelTempAlarmC - (wasActive(alarmKey) ? H.tempC : 0)) {
    out.push({
      ...base,
      key: alarmKey,
      priority: "P1",
      type: "overheating",
      title: "Panel overheating",
      detail: `${where} · ${fmtTemp(p.tempC)} (alarm above ${T.panelTempAlarmC} °C)`,
      target: { panelId: p.id },
    });
  } else if (p.tempC > T.panelTempWarnC - (wasActive(warnKey) ? H.tempC : 0)) {
    out.push({
      ...base,
      key: warnKey,
      priority: "P3",
      type: "panel-hot",
      title: "Panel running hot",
      detail: `${where} · ${fmtTemp(p.tempC)} (normal below ${T.panelTempWarnC} °C)`,
      target: { panelId: p.id },
    });
  }

  // Supply voltage, judged on the incomer.
  const nominal = CONFIG.electrical.voltageLN;
  const vMin = Math.min(...p.incomer.v);
  const vMax = Math.max(...p.incomer.v);
  const lowKey = `${p.id}:v-low`;
  const highKey = `${p.id}:v-high`;
  const lowLimit = nominal * (1 - (T.voltageTolerancePct - (wasActive(lowKey) ? H.voltagePct : 0)) / 100);
  const highLimit = nominal * (1 + (T.voltageTolerancePct - (wasActive(highKey) ? H.voltagePct : 0)) / 100);
  if (vMin < lowLimit) {
    out.push({
      ...base,
      key: lowKey,
      priority: "P2",
      type: "voltage-low",
      title: "Low voltage",
      detail: `${where} · ${fmtV(vMin)} L-N (minimum ${fmtV(nominal * (1 - T.voltageTolerancePct / 100))})`,
      target: { panelId: p.id },
    });
  } else if (vMax > highLimit) {
    out.push({
      ...base,
      key: highKey,
      priority: "P2",
      type: "voltage-high",
      title: "High voltage",
      detail: `${where} · ${fmtV(vMax)} L-N (maximum ${fmtV(nominal * (1 + T.voltageTolerancePct / 100))})`,
      target: { panelId: p.id },
    });
  }

  for (const f of p.feeders) {
    const on = `${f.name} on ${p.name}`;
    const target = { panelId: p.id, feederId: f.id };
    if (f.tripped) {
      out.push({ ...base, key: `${f.id}:trip`, priority: "P2", type: "feeder-trip", title: "Feeder tripped", detail: `${on} · breaker open, no load`, target });
      continue;
    }
    const iMax = Math.max(...f.i);
    const olKey = `${f.id}:overload`;
    if ((iMax / f.ratedA) * 100 > T.feederOverloadPct - (wasActive(olKey) ? H.overloadPct : 0)) {
      out.push({ ...base, key: olKey, priority: "P2", type: "overload", title: "Feeder overloaded", detail: `${on} · ${fmtA(iMax)} on a ${f.ratedA} A breaker`, target });
    }
    // Imbalance is meaningless on near-idle feeders.
    const imb = imbalancePct(f.i);
    const imbKey = `${f.id}:imbalance`;
    if (iMax > 5 && imb > T.phaseImbalancePct - (wasActive(imbKey) ? H.imbalancePct : 0)) {
      out.push({ ...base, key: imbKey, priority: "P3", type: "phase-imbalance", title: "Phase imbalance", detail: `${on} · ${fmtPct(imb)} between phases (limit ${T.phaseImbalancePct}%)`, target });
    }
    const pfKey = `${f.id}:low-pf`;
    if (f.kw > 1 && f.pf < T.lowPf + (wasActive(pfKey) ? H.pf : 0)) {
      out.push({ ...base, key: pfKey, priority: "P3", type: "low-pf", title: "Low power factor", detail: `${on} · PF ${fmtPf(f.pf)} (target ${fmtPf(T.lowPf)} or above) · penalty risk`, target });
    }
  }
  return out;
}

export function bmsConditions(points: BmsPoint[], wasActive: (key: string) => boolean): Condition[] {
  const out: Condition[] = [];
  for (const pt of points) {
    if (pt.system === "AHU" && pt.name === "Filter ΔP") {
      const key = `${pt.id}:dirty`;
      if (pt.value > T.filterDpHighPa - (wasActive(key) ? 10 : 0)) {
        out.push({
          key,
          buildingId: pt.buildingId,
          source: "bms",
          priority: "P3",
          type: "filter-dirty",
          title: "AHU filter dirty",
          detail: `${pt.equipment} · filter ΔP ${fmtPa(pt.value)} (limit ${T.filterDpHighPa} Pa)`,
          target: { equipment: pt.equipment },
        });
      }
    }
    if (pt.system === "Zone" && pt.setpoint !== undefined) {
      const key = `${pt.id}:warm`;
      if (pt.value > pt.setpoint + T.zoneOverSetpointC - (wasActive(key) ? 0.5 : 0)) {
        out.push({
          key,
          buildingId: pt.buildingId,
          source: "bms",
          priority: "P3",
          type: "zone-warm",
          title: "Zone too warm",
          detail: `${pt.equipment} · ${fmtTemp(pt.value)} vs setpoint ${fmtTemp(pt.setpoint)}`,
          target: { equipment: pt.equipment },
        });
      }
    }
  }
  return out;
}

export function assetConditions(a: Asset, wasActive: (key: string) => boolean): Condition[] {
  const key = `${a.id}:degrading`;
  if (a.health >= T.assetHealthAlarm + (wasActive(key) ? 2 : 0)) return [];
  const what = a.type === "AHU fan" ? "AHU fan" : a.type === "Condenser pump" ? "Condenser pump" : "Chilled water pump";
  const dtf = a.daysToFailure !== null ? ` · est. ${fmtNum(a.daysToFailure)} days to failure` : "";
  return [
    {
      key,
      buildingId: a.buildingId,
      source: "predictive",
      priority: "P2",
      type: "asset-degrading",
      title: `${what} wear detected`,
      detail: `${a.name} · health ${fmtNum(a.health)}/100${dtf}`,
      target: { assetId: a.id, equipment: a.name },
    },
  ];
}

export interface CrossCheck {
  equipment: string;
  bmsOn: boolean;
  kw: number;
  feederId: string;
  /** "running-while-off": BMS says OFF, meter sees load. "stopped-while-on": BMS says ON, meter sees nothing. */
  mismatch: "running-while-off" | "stopped-while-on" | null;
}

/** Compare what the BMS reports with what the Kuroshio meter measures, per metered piece of plant. */
export function crossChecks(points: BmsPoint[], feeders: Feeder[]): CrossCheck[] {
  const out: CrossCheck[] = [];
  for (const pt of points) {
    if (pt.kind !== "status") continue;
    const f = feeders.find((x) => x.name === pt.equipment);
    if (!f) continue;
    const bmsOn = pt.value === 1;
    const mismatch =
      !bmsOn && f.kw > CONFIG.crossCheck.runningKw
        ? "running-while-off"
        : bmsOn && !f.tripped && f.kw < CONFIG.crossCheck.stoppedKw
          ? "stopped-while-on"
          : null;
    out.push({ equipment: pt.equipment, bmsOn, kw: f.kw, feederId: f.id, mismatch });
  }
  return out;
}

export function crossCheckConditions(buildingId: string, points: BmsPoint[], feeders: Feeder[]): Condition[] {
  return crossChecks(points, feeders)
    .filter((c) => c.mismatch)
    .map((c) => ({
      key: `${buildingId}:${c.equipment}:xcheck`,
      buildingId,
      source: "bms" as const,
      priority: "P2" as const,
      type: "bms-mismatch" as const,
      title: "BMS and meter disagree",
      detail:
        c.mismatch === "running-while-off"
          ? `${c.equipment}: BMS shows OFF, meter shows ${fmtNum(c.kw, 1)} kW`
          : `${c.equipment}: BMS shows ON, meter shows ${fmtNum(c.kw, 1)} kW`,
      target: { equipment: c.equipment, feederId: c.feederId },
    }));
}
