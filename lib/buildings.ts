// Fictional demo portfolio (CLAUDE.md §7). Never put real client names here.

export type BuildingType = "Residential tower" | "Office" | "Retail" | "Mixed use" | "Residential";

export interface BuildingInfo {
  id: string;
  name: string;
  /** Short name for chips and tight spaces. */
  short: string;
  area: string;
  emirate: "Dubai" | "Abu Dhabi" | "Sharjah";
  type: BuildingType;
  /** Approximate position, used by the SVG map projection. */
  lat: number;
  lng: number;
}

export const BUILDINGS: readonly BuildingInfo[] = [
  { id: "marina-a", name: "Marina Tower A", short: "Marina A", area: "Dubai Marina", emirate: "Dubai", type: "Residential tower", lat: 25.08, lng: 55.14 },
  { id: "bb-plaza", name: "Business Bay Plaza", short: "BB Plaza", area: "Business Bay", emirate: "Dubai", type: "Office", lat: 25.186, lng: 55.27 },
  { id: "deira-annex", name: "Deira Mall Annex", short: "Deira Annex", area: "Deira", emirate: "Dubai", type: "Retail", lat: 25.27, lng: 55.32 },
  { id: "jlt-one", name: "JLT Cluster One", short: "JLT One", area: "JLT", emirate: "Dubai", type: "Mixed use", lat: 25.07, lng: 55.145 },
  { id: "reem-res", name: "Reem Island Residences", short: "Reem Res.", area: "Abu Dhabi", emirate: "Abu Dhabi", type: "Residential", lat: 24.5, lng: 54.405 },
  { id: "sharjah-hub", name: "Al Nahda Business Hub", short: "Al Nahda Hub", area: "Sharjah", emirate: "Sharjah", type: "Office", lat: 25.3, lng: 55.375 },
] as const;

export const DEFAULT_BUILDING_ID = "marina-a";

export function getBuilding(id: string | undefined): BuildingInfo | undefined {
  return BUILDINGS.find((b) => b.id === id);
}
