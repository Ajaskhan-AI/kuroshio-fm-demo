// The scripted K-Pulse incident (CLAUDE.md §6.10). Pure functions of "seconds since the presenter
// pressed P"; the engine applies them and the normal model and rules do the rest.
//
//  0 s   Marina Tower A stand-by pump CHW-P4 trips. CHW-P3 now carries the whole secondary loop.
//  0–8 s The VFD drives CHW-P3 up to full speed.
//  0–20 s CHW-P3 runs out on its curve to 135 % of best-efficiency flow. NPSH available falls while
//        NPSH required climbs; the margin drops from about 2.6 m to 0.3 m.
//  ~12 s "Running past best efficiency" (P3), then cavitation (P2) as HF and broadband noise rise.
//        A work order is raised automatically. It holds until the presenter resets.

import { clamp } from "../sim/random";

export const PULSE_INCIDENT = {
  pumpId: "marina-a:CHW-P3",
  standbyId: "marina-a:CHW-P4",
  duty: { to: 1.35, rampS: 20 },
  speed: { to: 1.0, rampS: 8 },
} as const;

const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

export function incidentOperating(elapsedS: number, from: { duty: number; speed: number }): { duty: number; speed: number } {
  const { duty, speed } = PULSE_INCIDENT;
  return {
    duty: from.duty + (duty.to - from.duty) * easeInOut(clamp(elapsedS / duty.rampS, 0, 1)),
    speed: from.speed + (speed.to - from.speed) * easeInOut(clamp(elapsedS / speed.rampS, 0, 1)),
  };
}
