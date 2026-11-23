// Seeded 24 h temperature history per chamber: stable across reloads, with defrost cycles and
// short door-open bumps during working hours.

import { BANDS, KSENSE } from "./config";
import type { Chamber } from "./types";
import { HOUR, MINUTE, dubaiHour } from "../sim/generators";
import { noise } from "../sim/random";

export const HISTORY_SLOT = 5 * MINUTE;

/** Is a freezer defrosting at time t? */
export function inDefrost(c: Pick<Chamber, "type" | "defrostPhaseMs">, t: number): boolean {
  if (c.type !== "frozen") return false;
  const every = KSENSE.defrost.everyH * HOUR;
  return (t + c.defrostPhaseMs) % every < KSENSE.defrost.durationMin * MINUTE;
}

/** Defrost plus a short pull-down afterwards: temperature alarms are held back for this window. */
export function defrostHold(c: Pick<Chamber, "type" | "defrostPhaseMs">, t: number): boolean {
  if (c.type !== "frozen") return false;
  const every = KSENSE.defrost.everyH * HOUR;
  return (t + c.defrostPhaseMs) % every < (KSENSE.defrost.durationMin + KSENSE.defrost.pullDownMin) * MINUTE;
}

/** Typical air temperature of a chamber at time t (history, not the live value). */
export function historicTemp(c: Pick<Chamber, "id" | "type" | "offsetC" | "defrostPhaseMs">, t: number): number {
  const band = BANDS[c.type];
  const slot = Math.floor(t / HISTORY_SLOT);
  // Smooth wander: average two neighbouring seeded values.
  const wander = (noise(c.id, slot) + noise(c.id, slot - 1) + noise(c.id, Math.floor(slot / 6))) / 3;
  let v = band.setpointC + c.offsetC + wander * 0.5;
  if (inDefrost(c, t)) v = KSENSE.defrost.airTempC + noise(c.id, "df", slot);
  else {
    const h = dubaiHour(t);
    const busy = h >= 6 && h < 22;
    if (busy && noise(c.id, "door", slot) > 0.9) v += c.type === "frozen" ? 1.8 : 0.9;
  }
  return v;
}

/** 24 h of history ending at `end`, one point per 5 minutes. */
export function chamberHistory(c: Pick<Chamber, "id" | "type" | "offsetC" | "defrostPhaseMs">, end: number, hours = 24): { t: number; c: number; defrost: boolean }[] {
  const last = Math.floor(end / HISTORY_SLOT) * HISTORY_SLOT;
  const n = (hours * HOUR) / HISTORY_SLOT;
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = last - (n - i) * HISTORY_SLOT;
    return { t, c: historicTemp(c, t), defrost: inDefrost(c, t) };
  });
}
