// Carbon (Scope 2) and monthly owner report data (CLAUDE.md §6.7). One builder feeds the on-screen
// preview, the PDF and the CSV, so all three always say the same thing.

import { getBuilding } from "./buildings";
import { CONFIG } from "./config";
import { buildingPf, dubaiMonth, findWaste, pctChange, pfRisk } from "./energy";
import { fmtAedEstimate } from "./format";
import { DAY, HOUR, buildingHistory, dayKwh, dubaiDayStart, kwhSinceMidnight } from "./sim/generators";
import { rngFor } from "./sim/random";
import { slaStats } from "./sim/sla";
import type { SimData } from "./sim/state";
import { scope2Tco2e } from "./tariff";
import type { Alarm, BuildingLive, Priority } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function monthParts(start: number) {
  const d = new Date(start + 4 * HOUR);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
}

/** kWh for one building between two Dubai midnights (model days), plus today's live kWh when the range reaches today. */
export function rangeKwh(b: BuildingLive, from: number, to: number, now: number): number {
  const today = dubaiDayStart(now);
  let kwh = 0;
  for (let d = from; d < Math.min(to, today); d += DAY) kwh += dayKwh(b.info.id, b.info.type, b.peakKw, d);
  if (to > today) kwh += b.kwhToday;
  return kwh;
}

export interface MonthPoint {
  key: string;
  label: string;
  partial: boolean;
  /** tCO₂e per building id. */
  byBuilding: Record<string, number>;
  total: number;
}

/** Scope 2 per month for the last 12 months (current month to date last). */
export function carbonByMonth(buildings: BuildingLive[], now: number): MonthPoint[] {
  const out: MonthPoint[] = [];
  for (let back = 11; back >= 0; back--) {
    const { start, days } = dubaiMonth(now, back);
    const { y, m } = monthParts(start);
    const byBuilding: Record<string, number> = {};
    let total = 0;
    for (const b of buildings) {
      const t = scope2Tco2e(rangeKwh(b, start, start + days * DAY, now));
      byBuilding[b.info.id] = t;
      total += t;
    }
    out.push({ key: `${y}-${m}`, label: `${MONTHS[m]}${back === 0 ? "*" : ""}`, partial: back === 0, byBuilding, total });
  }
  return out;
}

export interface CarbonRow {
  building: BuildingLive;
  mtdKwh: number;
  mtdT: number;
  lastMonthSameT: number;
  ytdT: number;
}

export function carbonRows(buildings: BuildingLive[], now: number): CarbonRow[] {
  const today = dubaiDayStart(now);
  const { start } = dubaiMonth(now);
  const { start: lmStart } = dubaiMonth(now, 1);
  const elapsed = Math.round((today - start) / DAY);
  const yearStart = (() => {
    const { y } = monthParts(start);
    return Date.UTC(y, 0, 1) - 4 * HOUR;
  })();
  return buildings.map((b) => {
    const mtdKwh = rangeKwh(b, start, today + DAY, now);
    const lmKwh = rangeKwh(b, lmStart, lmStart + elapsed * DAY, now) + kwhSinceMidnight(b.info.id, b.info.type, b.peakKw, lmStart + elapsed * DAY + (now - today));
    return {
      building: b,
      mtdKwh,
      mtdT: scope2Tco2e(mtdKwh),
      lastMonthSameT: scope2Tco2e(lmKwh),
      ytdT: scope2Tco2e(rangeKwh(b, yearStart, today + DAY, now)),
    };
  });
}

// ---- Monthly owner report ------------------------------------------------------------

export interface ReportData {
  buildingId: string;
  buildingName: string;
  area: string;
  type: string;
  periodLabel: string;
  generatedAt: number;
  uptimePct: number;
  alarmsHandled: number;
  alarmsOpen: number;
  slaPct: number | null;
  p1AvgResponseMin: number | null;
  energyKwh: number;
  energyVsLastMonthPct: number;
  costAed: number;
  tco2e: number;
  factor: number;
  peakKw: number;
  pf: number;
  incidents: { priority: Priority; title: string; detail: string; raisedAt: number; status: Alarm["status"] }[];
  recommendations: { title: string; detail: string }[];
  daily: { day: number; kwh: number; costAed: number; tco2e: number; peakKw: number; partial: boolean }[];
}

export function buildReport(s: SimData, buildingId: string, now: number): ReportData | null {
  const b = s.buildings[buildingId];
  const info = getBuilding(buildingId);
  if (!b || !info) return null;
  const panels = s.panelIds[buildingId].map((id) => s.panels[id]);
  const today = dubaiDayStart(now);
  const { start, days } = dubaiMonth(now);
  const { y, m } = monthParts(start);
  const dayOfMonth = Math.round((today - start) / DAY) + 1;

  const row = carbonRows([b], now)[0];
  const lmKwh = (row.lastMonthSameT / CONFIG.emissionFactor.tCo2ePerMwh) * 1000;

  // Meter data availability: high and stable, dented by any panel offline right now.
  const r = rngFor(buildingId, "uptime", y, m);
  const offlineNow = panels.filter((p) => p.status === "offline").length;
  const uptimePct = Math.min(99.98, 99.55 + r() * 0.4) - offlineNow * 0.05;

  const monthOrders = s.workOrders.filter((w) => w.buildingId === buildingId && w.createdAt >= start);
  const handled = monthOrders.filter((w) => w.status === "closed").length;
  const open = monthOrders.filter((w) => w.status !== "closed").length;
  const sla = slaStats(monthOrders, now, days);
  const p1 = slaStats(
    monthOrders.filter((w) => w.priority === "P1"),
    now,
    days,
  );

  const daily = [];
  for (let d = 0; d < dayOfMonth; d++) {
    const day = start + d * DAY;
    const partial = day === today;
    const kwh = partial ? b.kwhToday : dayKwh(buildingId, info.type, b.peakKw, day);
    const peakKw = Math.max(...buildingHistory(buildingId, info.type, b.peakKw, partial ? now : day + DAY - 1, partial ? (now - day) / HOUR : 24, 60).map((p) => p.kw), partial ? b.kw : 0);
    daily.push({ day, kwh, costAed: kwh * b.rateAedPerKwh, tco2e: scope2Tco2e(kwh), peakKw, partial });
  }

  const incidents = s.alarms
    .filter((a) => a.buildingId === buildingId && a.priority !== "P3" && a.raisedAt >= start)
    .sort((a, c) => c.raisedAt - a.raisedAt)
    .slice(0, 6)
    .map((a) => ({ priority: a.priority, title: a.title, detail: a.detail, raisedAt: a.raisedAt, status: a.status }));

  // Top 3 recommendations: biggest waste, worst motor, then power factor or the next waste item.
  const recs: ReportData["recommendations"] = [];
  const waste = findWaste(b, panels, s.bmsPoints[buildingId], now);
  if (waste[0]) recs.push({ title: `Fix: ${waste[0].title}`, detail: `${waste[0].where}. ${waste[0].evidence}. Worth about ${fmtAedEstimate(waste[0].aedPerMonth)} a month.` });
  const worstAsset = Object.values(s.assets)
    .filter((a) => a.buildingId === buildingId)
    .sort((a, c) => a.health - c.health)[0];
  if (worstAsset && worstAsset.health < 80) {
    recs.push({
      title: `${worstAsset.name}: ${worstAsset.recommendation.replace(/\.$/, "")}`,
      detail: `Health ${Math.round(worstAsset.health)}/100${worstAsset.daysToFailure !== null ? `, about ${worstAsset.daysToFailure} days to failure` : ""}. Planned repair costs less than a breakdown.`,
    });
  }
  const pf = buildingPf(panels);
  if (pfRisk(pf) !== "low") {
    recs.push({ title: "Review power factor correction", detail: `Power factor ${pf.toFixed(2)}, close to the ${CONFIG.pfPenaltyThreshold.toFixed(2)} penalty threshold. Check the capacitor bank.` });
  }
  for (const w of waste.slice(1)) {
    if (recs.length >= 3) break;
    recs.push({ title: `Fix: ${w.title}`, detail: `${w.where}. Worth about ${fmtAedEstimate(w.aedPerMonth)} a month.` });
  }

  return {
    buildingId,
    buildingName: info.name,
    area: info.area,
    type: info.type,
    periodLabel: `${MONTHS_LONG[m]} ${y} · 1–${dayOfMonth} ${MONTHS[m]} (month to date)`,
    generatedAt: now,
    uptimePct,
    alarmsHandled: handled,
    alarmsOpen: open,
    slaPct: sla.compliancePct,
    p1AvgResponseMin: p1.avgResponseMs === null ? null : p1.avgResponseMs / 60_000,
    energyKwh: row.mtdKwh,
    energyVsLastMonthPct: pctChange(row.mtdKwh, lmKwh),
    costAed: row.mtdKwh * b.rateAedPerKwh,
    tco2e: row.mtdT,
    factor: CONFIG.emissionFactor.tCo2ePerMwh,
    peakKw: Math.max(...daily.map((d) => d.peakKw)),
    pf,
    incidents,
    recommendations: recs.slice(0, 3),
    daily,
  };
}

/** CSV of the month's daily data (UTF-8 with BOM so Excel shows ₂ and Arabic-locale settings correctly). */
export function reportCsv(r: ReportData): string {
  const head = ["Date", "Energy (kWh)", "Cost (AED)", "Scope 2 (tCO2e)", "Peak demand (kW)", "Note"];
  const fmtDay = (t: number) => new Date(t + 4 * HOUR).toISOString().slice(0, 10);
  const lines = r.daily.map((d) =>
    [fmtDay(d.day), d.kwh.toFixed(1), d.costAed.toFixed(2), d.tco2e.toFixed(3), d.peakKw.toFixed(1), d.partial ? "Today so far" : ""].join(","),
  );
  const meta = [
    `# Kuroshio FacilityIQ - ${r.buildingName} (${r.area}) - ${r.periodLabel}`,
    `# DEMO DATA. Emission factor ${r.factor} tCO2e/MWh and tariff are demo assumptions.`,
  ];
  return "﻿" + [...meta, head.join(","), ...lines].join("\r\n") + "\r\n";
}
