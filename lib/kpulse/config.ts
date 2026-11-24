// K-Pulse rotating-equipment condition monitoring: every demo assumption in one place (CLAUDE.md §6.10).
// Zone limits follow the shape of ISO 10816-3 / ISO 20816-3 (velocity RMS, rigid foundation). All other
// thresholds are typical figures for illustration, not a quoted standard or a guarantee.

import { CONFIG } from "../config";

/** ISO 10816-3 machine groups: zone boundaries for velocity RMS, mm/s (A/B, B/C, C/D). */
export const ISO_ZONES = {
  /** Group 2: 15–300 kW, rigid foundation. */
  group2: { ab: 1.4, bc: 2.8, cd: 4.5 },
  /** Group 1: 300 kW – 50 MW, rigid foundation. */
  group1: { ab: 2.3, bc: 4.5, cd: 7.1 },
} as const;

export type IsoGroup = keyof typeof ISO_ZONES;
export type IsoZone = "A" | "B" | "C" | "D";

export const ZONE_TEXT: Record<IsoZone, string> = {
  A: "Zone A · Good",
  B: "Zone B · Acceptable",
  C: "Zone C · Alert",
  D: "Zone D · Danger",
};

export const KPULSE = {
  thresholds: {
    /** Kurtosis of a healthy bearing is about 3; above this, impacts are showing up. */
    kurtosisWarn: 4,
    kurtosisAlarm: 6,
    /** High-frequency (envelope) acceleration, gE. */
    hfWarn: 1.0,
    hfAlarm: 2.5,
    /** Bearing housing temperature, °C. */
    tempWarnC: 70,
    tempAlarmC: 85,
    /** NPSH margin (available − required), m. */
    npshMarginWarnM: 1.0,
    npshMarginAlarmM: 0.5,
    /** Pumps should run between these shares of best-efficiency flow. */
    bepLowPct: 70,
    bepHighPct: 120,
    /** Spectrum peaks, mm/s. */
    peak1xWarn: 2.5,
    peak2xWarn: 1.5,
    harmonicsWarn: 0.6,
    electrical100HzWarn: 1.0,
    beltWarn: 1.0,
    /** Centrifugal compressor: distance from the surge line, %. */
    surgeMarginWarnPct: 10,
    /** Health below which an asset counts as needing attention. */
    healthWarn: 75,
    healthAlarm: 55,
    /** "Days to alert limit" = days until health reaches this, at the current rate. */
    healthAlertLimit: 55,
  },
  physics: {
    waterDensity: 998,
    g: 9.81,
    motorEfficiency: 0.93,
    /** Suction pressure for the CHW loop, bar (gauge). */
    suctionBar: 1.6,
  },
  /** Blended rate for "AED lost", from the top tariff slab plus fuel surcharge (demo assumption). */
  aedPerKwh: (CONFIG.tariff.slabs[CONFIG.tariff.slabs.length - 1].fils + CONFIG.tariff.fuelSurchargeFils) / 100,
  /** Running hours per month used to turn kW lost into AED per month. Demo assumption. */
  runHoursPerMonth: 600,
  /** Typical repair costs avoided when a fault is caught early, AED. Demo assumptions, not quotes. */
  repairAed: { impeller: 18_000, bearing: 6_500, motorRewind: 22_000, fanBlades: 9_000, belt: 900, compressorOverhaul: 85_000 },
  /** Live readings kept per asset for the "last few minutes" of the charts. */
  recentPoints: 150,
  /** Spectrum resolution, Hz. */
  spectrumStepHz: 1,
} as const;
