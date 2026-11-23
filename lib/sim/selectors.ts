import type { Alarm, Feeder, HealthStatus, Panel, Priority } from "../types";

const RANK: Record<Priority, number> = { P1: 0, P2: 1, P3: 2 };

export const openAlarms = (alarms: Alarm[]) => alarms.filter((a) => a.status !== "cleared");

/** Worst first (priority), newest first within a priority. */
export function sortAlarms(alarms: Alarm[]): Alarm[] {
  return [...alarms].sort((a, b) => RANK[a.priority] - RANK[b.priority] || b.raisedAt - a.raisedAt);
}

export function panelStatus(p: Panel, open: Alarm[]): HealthStatus {
  if (p.status === "offline") return "offline";
  const mine = open.filter((a) => a.target.panelId === p.id);
  if (p.status === "tripped" || mine.some((a) => a.priority === "P1")) return "alarm";
  return mine.length ? "warning" : "online";
}

export function feederAlarm(f: Feeder, open: Alarm[]): Alarm | undefined {
  return sortAlarms(open.filter((a) => a.target.feederId === f.id))[0];
}

export const avg3 = (t: readonly number[]) => (t[0] + t[1] + t[2]) / 3;
