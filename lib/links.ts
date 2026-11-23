import type { Alarm } from "./types";

export const buildingHref = (id: string) => `/buildings/${id}/smdb`;

/** Where an alarm's cause lives — clicking anything red goes here (CLAUDE.md §5). */
export function alarmHref(a: Pick<Alarm, "buildingId" | "source" | "target">): string {
  if (a.source === "predictive" && a.target.assetId) return `/maintenance?asset=${encodeURIComponent(a.target.assetId)}`;
  if (a.source === "bms") return `/buildings/${a.buildingId}/bms`;
  const panel = a.target.panelId?.split(":")[1];
  return panel ? `/buildings/${a.buildingId}/smdb?panel=${panel}` : buildingHref(a.buildingId);
}
