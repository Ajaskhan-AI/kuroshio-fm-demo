import type { HealthStatus, Priority } from "../types";
import { fmtDuration, fmtNum } from "../format";
import { DAY } from "../sim/generators";
import { BANDS } from "./config";
import { isColdOpen } from "./engine";
import { chamberHistory } from "./history";
import { getColdSite } from "./sites";
import type { Chamber, ColdAlarm, Excursion } from "./types";

const RANK: Record<Priority, number> = { P1: 0, P2: 1, P3: 2 };

export const sortAlarms = (list: ColdAlarm[]) => [...list].sort((a, b) => RANK[a.priority] - RANK[b.priority] || b.raisedAt - a.raisedAt);

export function openColdAlarms(alarms: ColdAlarm[]): ColdAlarm[] {
  return sortAlarms(alarms.filter(isColdOpen));
}

export const isTempAlarm = (a: ColdAlarm) => a.type === "temp-high" || a.type === "temp-low";

/** One status per chamber for tiles and chips. Always shown with an icon and words. */
export function chamberStatus(c: Chamber, open: ColdAlarm[]): { status: HealthStatus; label: string } {
  const mine = open.filter((a) => a.chamberId === c.id);
  const temp = mine.find(isTempAlarm);
  if (temp) return { status: "alarm", label: temp.type === "temp-high" ? "Out of range" : "Too cold" };
  const p1 = mine.find((a) => a.priority === "P1");
  if (p1) return { status: "alarm", label: p1.title };
  if (mine.length) return { status: "warning", label: mine[0].title };
  if (c.defrosting) return { status: "online", label: "Defrost" };
  return { status: "online", label: "In range" };
}

export const bandText = (c: Pick<Chamber, "type">) => {
  const b = BANDS[c.type];
  return `${b.lowC} to ${b.highC} °C`;
};

/** Share of chamber-time inside the band over the last 30 days, from the excursion log. */
export function timeInRangePct(excursions: Excursion[], chamberCount: number, now: number): number {
  const from = now - 30 * DAY;
  const outMs = excursions.reduce((sum, e) => sum + Math.max(0, (e.endedAt ?? now) - Math.max(e.startedAt, from)), 0);
  return 100 * (1 - outMs / (chamberCount * 30 * DAY));
}

// ---- CSV exports -----------------------------------------------------------------------------

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: (string | number)[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\n");
const iso = (t: number) => new Date(t + 4 * 3_600_000).toISOString().slice(0, 16).replace("T", " ");

/** Temperature log for one chamber: hourly min / avg / max for 24 h, plus its excursions. */
export function chamberLogCsv(c: Chamber, excursions: Excursion[], now: number): string {
  const site = getColdSite(c.siteId);
  const band = BANDS[c.type];
  const hist = chamberHistory(c, now);
  const rows: (string | number)[][] = [
    ["K-Sense temperature log (demo data)"],
    ["Site", site?.name ?? c.siteId],
    ["Chamber", `${c.name} · ${c.product}`],
    ["Allowed range", `${band.lowC} to ${band.highC} °C`],
    ["Generated (Dubai time)", iso(now)],
    [],
    ["Hour starting", "Min °C", "Avg °C", "Max °C", "Defrost"],
  ];
  for (let i = 0; i + 12 <= hist.length; i += 12) {
    const slice = hist.slice(i, i + 12);
    const vals = slice.map((p) => p.c);
    rows.push([
      iso(slice[0].t),
      fmtNum(Math.min(...vals), 1),
      fmtNum(vals.reduce((a, v) => a + v, 0) / vals.length, 1),
      fmtNum(Math.max(...vals), 1),
      slice.some((p) => p.defrost) ? "yes" : "",
    ]);
  }
  const mine = excursions.filter((e) => e.chamberId === c.id);
  rows.push([], ["Excursions (last 30 days)"], ["Started", "Duration", "Peak °C", "Limit °C", "Cause"]);
  if (!mine.length) rows.push(["None"]);
  for (const e of mine) rows.push([iso(e.startedAt), e.endedAt ? fmtDuration(e.endedAt - e.startedAt) : "ongoing", fmtNum(e.peakC, 1), e.limitC, e.cause]);
  return csv(rows);
}

export function excursionLogCsv(excursions: Excursion[], chambers: Record<string, Chamber>, now: number): string {
  const rows: (string | number)[][] = [
    ["K-Sense excursion log (demo data)"],
    ["Generated (Dubai time)", iso(now)],
    [],
    ["Site", "Chamber", "Product", "Started", "Duration", "Peak °C", "Limit °C", "Cause", "Status"],
  ];
  for (const e of excursions) {
    const c = chambers[e.chamberId];
    rows.push([
      getColdSite(e.siteId)?.name ?? e.siteId,
      c?.name ?? e.chamberId,
      c?.product ?? "",
      iso(e.startedAt),
      fmtDuration((e.endedAt ?? now) - e.startedAt),
      fmtNum(e.peakC, 1),
      e.limitC,
      e.cause,
      e.endedAt ? "Closed" : "Ongoing",
    ]);
  }
  return csv(rows);
}

export function saveFile(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
}
