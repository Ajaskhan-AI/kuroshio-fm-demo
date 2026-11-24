import type { HealthStatus, Priority } from "../types";
import { KPULSE, ZONE_TEXT, type IsoZone } from "./config";
import { isObsOpen } from "./engine";
import { maxVelocity, zoneOf } from "./physics";
import { energyLostAedMonth } from "./rules";
import type { Observation, RotatingAsset, SensorPoint } from "./types";

const RANK: Record<Priority, number> = { P1: 0, P2: 1, P3: 2 };

export const sortObservations = (list: Observation[]) => [...list].sort((a, b) => RANK[a.priority] - RANK[b.priority] || b.raisedAt - a.raisedAt);

export const openObservations = (list: Observation[]) => sortObservations(list.filter(isObsOpen));

export const assetZone = (a: RotatingAsset): IsoZone => zoneOf(maxVelocity(a.readings), a.iso);

/** One status per asset for tiles and chips. Always shown with an icon and words. */
export function assetStatus(a: RotatingAsset, open: Observation[]): { status: HealthStatus; label: string } {
  if (a.tripped) return { status: "alarm", label: "Stopped" };
  const mine = open.filter((o) => o.assetId === a.id);
  const top = sortObservations(mine)[0];
  const t = KPULSE.thresholds;
  if (top?.priority === "P1" || a.health < t.healthAlarm) return { status: "alarm", label: top?.title ?? "Act now" };
  if (top || a.health < t.healthWarn) return { status: "warning", label: top?.title ?? "Watch" };
  return { status: "online", label: "Healthy" };
}

export const zoneStatus: Record<IsoZone, HealthStatus> = { A: "online", B: "online", C: "warning", D: "alarm" };
export const zoneLabel = (z: IsoZone) => ZONE_TEXT[z];

export const POINT_LABEL: Record<SensorPoint, string> = {
  "motor-nde": "Motor NDE",
  "motor-de": "Motor DE",
  "machine-de": "Machine DE",
  "machine-nde": "Machine NDE",
};

export function pointLabel(a: Pick<RotatingAsset, "kind">, pt: SensorPoint): string {
  const machine = a.kind === "pump" ? "Pump" : a.kind === "fan" ? "Fan" : "Compressor";
  return pt.startsWith("motor") ? POINT_LABEL[pt] : `${machine} ${pt === "machine-de" ? "DE" : "NDE"}`;
}

/** Days until health reaches the alert limit at the 30-day rate of decline; null when stable. */
export function daysToAlertLimit(health: number, daily: number[]): number | null {
  const limit = KPULSE.thresholds.healthAlertLimit;
  if (daily.length < 2) return null;
  if (health <= limit) return 0;
  const recent = daily.slice(-10);
  const decline = (recent[0] - recent[recent.length - 1]) / (recent.length - 1);
  if (decline <= 0.15) return null;
  return Math.max(1, Math.round((health - limit) / decline));
}

export const fleetEnergyLost = (assets: RotatingAsset[]) => assets.reduce((sum, a) => sum + energyLostAedMonth(a, a.readings, a.op, a.sev), 0);
