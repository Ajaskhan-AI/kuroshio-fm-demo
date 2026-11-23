import type { AssetType } from "../types";

/** Estimate days to failure from the 30-day health trend (health 40 = end of life in this demo model). */
export function estimateDaysToFailure(health: number, history: number[]): number | null {
  if (history.length < 2 || health >= 80) return null;
  const decline = (history[0] - history[history.length - 1]) / (history.length - 1);
  if (decline <= 0.05) return null;
  return Math.max(1, Math.round((health - 40) / decline));
}

/** Plain-language next step for the FM team. No accuracy claims (CLAUDE.md §6.6). */
export function recommendationFor(type: AssetType, health: number, daysToFailure: number | null): string {
  const part = type === "AHU fan" ? "fan belt and bearing" : "pump bearing";
  if (health >= 80) return "No action needed. Keep the routine PPM schedule.";
  if (health >= 70 || daysToFailure === null) return `Watch closely: check the ${part} at the next PPM visit.`;
  const within = Math.min(14, Math.max(3, Math.round(daysToFailure * 0.4)));
  return `Inspect ${part} within ${within} days.`;
}
