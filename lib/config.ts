// All demo assumptions in one place (CLAUDE.md §8). Values marked `demoAssumption`
// are illustrative, not quoted tariffs or official factors, and the UI says so.

export const CONFIG = {
  /** Live simulation tick. */
  tickMs: 2000,

  electrical: {
    voltageLL: 400,
    voltageLN: 230,
    frequencyHz: 50,
  },

  /** DEWA-style commercial slab tariff, fils per kWh per month. Demo assumption, editable. */
  tariff: {
    label: "DEWA-style commercial tariff",
    demoAssumption: true,
    slabs: [
      { upToKwh: 2_000, fils: 23 },
      { upToKwh: 4_000, fils: 28 },
      { upToKwh: 6_000, fils: 32 },
      { upToKwh: Number.POSITIVE_INFINITY, fils: 38 },
    ],
    fuelSurchargeFils: 6.5,
  },

  /** Grid emission factor for Scope 2. Demo assumption, editable; shown as "Factor used". */
  emissionFactor: {
    label: "Grid emission factor",
    demoAssumption: true,
    tCo2ePerMwh: 0.4,
  },

  /** Work-order SLA targets in minutes (CLAUDE.md §6.5). */
  slaMinutes: { P1: 30, P2: 240, P3: 1_440 },

  thresholds: {
    panelTempWarnC: 45,
    panelTempAlarmC: 60,
    phaseImbalancePct: 10,
    lowPf: 0.85,
    voltageTolerancePct: 10,
    /** Feeder overload when any phase current exceeds this % of the breaker rating. */
    feederOverloadPct: 100,
    filterDpHighPa: 250,
    zoneOverSetpointC: 3,
    assetHealthAlarm: 70,
  },

  /** Hysteresis so alarms don't flap when a value hovers at a threshold. */
  hysteresis: {
    tempC: 2,
    pf: 0.02,
    imbalancePct: 2,
    voltagePct: 2,
    overloadPct: 5,
  },

  /** Random minor events elsewhere in the portfolio so it never looks static (§7). */
  minorEvents: { minIntervalS: 30, maxIntervalS: 60, minDurationS: 60, maxDurationS: 180 },

  /** BMS vs meter cross-check (CLAUDE.md §6.3). */
  crossCheck: {
    /** Above this, equipment the BMS calls OFF is really running. */
    runningKw: 3,
    /** Below this, equipment the BMS calls ON is really stopped. */
    stoppedKw: 0.5,
    /** Hours a day an unnoticed mismatch would typically waste (e.g. 22:00–06:00). Demo assumption. */
    wasteHoursPerDay: 8,
  },

  /**
   * After-hours waste finder (CLAUDE.md §6.4). Demo assumptions, editable.
   * Window = when the building is meant to be quiet; expected = the share of a feeder's daytime
   * peak that is reasonable to still be running then (security lighting, servers, fridges…).
   * EV chargers are left out on purpose: overnight charging is the behaviour you want.
   */
  afterHours: {
    window: {
      Office: { from: 20, to: 7 },
      Retail: { from: 23, to: 9 },
      "Mixed use": { from: 23, to: 6 },
      "Residential tower": { from: 1, to: 5 },
      Residential: { from: 1, to: 5 },
    },
    expectedShare: {
      commercial: { lighting: 0.12, power: 0.18, ventilation: 0.2 },
      residential: { lighting: 0.3, power: 0.4, ventilation: 0.3 },
    },
    /** Findings worth less than this are not listed. */
    minAedPerMonth: 150,
  },

  /** Power factor below this risks a utility penalty or surcharge. Demo assumption. */
  pfPenaltyThreshold: 0.9,

  /** Manual meter-reading rounds a technician would otherwise do, per panel per day. Demo assumption. */
  manualRoundsPerPanelPerDay: 2,
  /** Minutes a technician spends reaching and reading one panel by hand. Demo assumption. */
  minutesPerManualReading: 6,
} as const;

export type Priority = keyof typeof CONFIG.slaMinutes;
