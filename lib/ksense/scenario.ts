// The scripted K-Sense incident (CLAUDE.md §6.9). Pure functions of "seconds since the presenter
// pressed K"; the engine applies them and the normal rules raise the alarms and log the excursion.
//
//  0 s   Jebel Ali FR-02 dock door left open: −21 → −12 °C over 30 s (door alarm at 10 s, excursion past −18 °C)
//  5 s   KIZAD PH-02 suction pressure falls 3.9 → 2.7 bar over 30 s, room still in range → leak alarm
//  35 s  The door closes; FR-02 recovers to −21 °C by ~60 s and the excursion is logged

import { clamp } from "../sim/random";

export const COLD_INCIDENT = {
  doorChamberId: "jebel-ali:FR-02",
  leakChamberId: "kizad:PH-02",
  temp: { from: -21, to: -12, rampS: 30 },
  doorOpenS: 35,
  recoverS: 25,
  leak: { startS: 5, from: 3.9, to: 2.7, rampS: 30 },
} as const;

const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

export const incidentDoorOpen = (elapsedS: number) => elapsedS >= 0 && elapsedS < COLD_INCIDENT.doorOpenS;

/** FR-02 temperature during the incident, or undefined once it has recovered (normal simulation resumes). */
export function incidentTemp(elapsedS: number): number | undefined {
  const { temp, doorOpenS, recoverS } = COLD_INCIDENT;
  if (elapsedS < doorOpenS) return temp.from + (temp.to - temp.from) * easeInOut(clamp(elapsedS / temp.rampS, 0, 1));
  const back = (elapsedS - doorOpenS) / recoverS;
  if (back > 1) return undefined;
  return temp.to + (temp.from - temp.to) * easeInOut(back);
}

/** PH-02 suction pressure, bar; holds at the low value once reached (the leak doesn't fix itself). */
export function incidentSuction(elapsedS: number): number | undefined {
  const { startS, from, to, rampS } = COLD_INCIDENT.leak;
  if (elapsedS < startS) return undefined;
  return from + (to - from) * clamp((elapsedS - startS) / rampS, 0, 1);
}
