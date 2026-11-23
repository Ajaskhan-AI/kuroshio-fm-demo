// ROI calculator (CLAUDE.md §6.8). Pure maths over inputs + assumptions; the page shows every
// assumption and lets the visitor change it, so nothing here is presented as a quote.

import { CONFIG } from "./config";

export interface RoiInputs {
  buildings: number;
  smdbsPerBuilding: number;
  technicians: number;
  hourlyCostAed: number;
  monthlyBillAed: number;
}

export interface RoiAssumptions {
  /** Share of the energy bill saved by fixing waste, % (spec: 5–10 %). */
  energySavingPct: number;
  readingsPerSmdbPerDay: number;
  minutesPerReading: number;
  /** One-off meter hardware + installation per SMDB, AED. Demo assumption, not a quote. */
  hardwarePerSmdbAed: number;
  /** Monthly platform fee per SMDB, AED. Demo assumption, not a quote. */
  monthlyPerSmdbAed: number;
}

export const ROI_DEFAULT_INPUTS: RoiInputs = { ...CONFIG.roi.inputs };
export const ROI_DEFAULT_ASSUMPTIONS: RoiAssumptions = { ...CONFIG.roi.assumptions };

/** Working hours a technician has in a year, for "share of the team's time". */
const TECH_HOURS_PER_YEAR = 2_000;

export interface RoiResult {
  smdbs: number;
  hoursSavedPerYear: number;
  /** Share of the round-doing team's working time freed, %. */
  teamTimeFreedPct: number;
  roundsSavingAed: number;
  wasteSavingAed: number;
  totalSavingAed: number;
  oneOffCostAed: number;
  annualFeeAed: number;
  netAnnualAed: number;
  /** null when the yearly saving doesn't cover the yearly fee. */
  paybackMonths: number | null;
}

export function calcRoi(i: RoiInputs, a: RoiAssumptions): RoiResult {
  const smdbs = Math.max(0, i.buildings) * Math.max(0, i.smdbsPerBuilding);
  const hoursSavedPerYear = (smdbs * a.readingsPerSmdbPerDay * a.minutesPerReading * 365) / 60;
  const teamHours = Math.max(1, i.technicians) * TECH_HOURS_PER_YEAR;
  const roundsSavingAed = hoursSavedPerYear * i.hourlyCostAed;
  const wasteSavingAed = i.monthlyBillAed * 12 * (a.energySavingPct / 100);
  const totalSavingAed = roundsSavingAed + wasteSavingAed;
  const oneOffCostAed = smdbs * a.hardwarePerSmdbAed;
  const annualFeeAed = smdbs * a.monthlyPerSmdbAed * 12;
  const netAnnualAed = totalSavingAed - annualFeeAed;
  return {
    smdbs,
    hoursSavedPerYear,
    teamTimeFreedPct: Math.min(100, (hoursSavedPerYear / teamHours) * 100),
    roundsSavingAed,
    wasteSavingAed,
    totalSavingAed,
    oneOffCostAed,
    annualFeeAed,
    netAnnualAed,
    paybackMonths: netAnnualAed > 0 ? (oneOffCostAed / netAnnualAed) * 12 : null,
  };
}
