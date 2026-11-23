// Fictional cold-store portfolio for the K-Sense demo. No real operators or clients.

import type { ChamberType } from "./config";
import type { ColdSite } from "./types";

export const COLD_SITES: ColdSite[] = [
  { id: "jebel-ali", name: "Jebel Ali Cold Hub", short: "Jebel Ali", area: "Jebel Ali, Dubai" },
  { id: "dip", name: "DIP Frozen Foods DC", short: "DIP", area: "Dubai Investments Park" },
  { id: "al-quoz", name: "Al Quoz Fresh Store", short: "Al Quoz", area: "Al Quoz, Dubai" },
  { id: "kizad", name: "KIZAD Pharma Cold Store", short: "KIZAD", area: "KIZAD, Abu Dhabi" },
  { id: "sharjah", name: "Al Sajaa Cold Logistics", short: "Al Sajaa", area: "Al Sajaa, Sharjah" },
];

export interface ChamberTemplate {
  site: string;
  name: string;
  type: ChamberType;
  product: string;
  pallets: number;
  stockAed: number;
}

export const CHAMBER_TEMPLATES: ChamberTemplate[] = [
  { site: "jebel-ali", name: "FR-01", type: "frozen", product: "Frozen poultry", pallets: 420, stockAed: 380_000 },
  { site: "jebel-ali", name: "FR-02", type: "frozen", product: "Ice cream", pallets: 260, stockAed: 285_000 },
  { site: "jebel-ali", name: "CH-01", type: "chilled", product: "Dairy", pallets: 310, stockAed: 190_000 },
  { site: "jebel-ali", name: "CH-02", type: "chilled", product: "Fresh meat", pallets: 180, stockAed: 240_000 },
  { site: "jebel-ali", name: "PR-01", type: "produce", product: "Fruit and vegetables", pallets: 220, stockAed: 95_000 },
  { site: "dip", name: "FR-01", type: "frozen", product: "Frozen seafood", pallets: 380, stockAed: 450_000 },
  { site: "dip", name: "FR-02", type: "frozen", product: "Frozen bakery", pallets: 300, stockAed: 160_000 },
  { site: "dip", name: "FR-03", type: "frozen", product: "Ready meals", pallets: 240, stockAed: 210_000 },
  { site: "dip", name: "CH-01", type: "chilled", product: "Dairy", pallets: 200, stockAed: 130_000 },
  { site: "al-quoz", name: "CH-01", type: "chilled", product: "Fresh poultry", pallets: 160, stockAed: 150_000 },
  { site: "al-quoz", name: "CH-02", type: "chilled", product: "Cut flowers", pallets: 90, stockAed: 70_000 },
  { site: "al-quoz", name: "PR-01", type: "produce", product: "Bananas", pallets: 140, stockAed: 55_000 },
  { site: "al-quoz", name: "PR-02", type: "produce", product: "Citrus", pallets: 120, stockAed: 48_000 },
  { site: "kizad", name: "PH-01", type: "pharma", product: "Vaccines", pallets: 60, stockAed: 2_400_000 },
  { site: "kizad", name: "PH-02", type: "pharma", product: "Insulin", pallets: 75, stockAed: 1_850_000 },
  { site: "kizad", name: "PH-03", type: "pharma", product: "Biologics", pallets: 40, stockAed: 3_100_000 },
  { site: "kizad", name: "FR-01", type: "frozen", product: "Frozen reagents", pallets: 30, stockAed: 620_000 },
  { site: "sharjah", name: "FR-01", type: "frozen", product: "Frozen meat", pallets: 350, stockAed: 330_000 },
  { site: "sharjah", name: "CH-01", type: "chilled", product: "Dairy", pallets: 240, stockAed: 140_000 },
  { site: "sharjah", name: "PR-01", type: "produce", product: "Potatoes and onions", pallets: 300, stockAed: 60_000 },
];

export const getColdSite = (id: string | undefined) => COLD_SITES.find((s) => s.id === id);
