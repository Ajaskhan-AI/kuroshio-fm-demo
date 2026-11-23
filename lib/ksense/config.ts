// K-Sense cold chain: every demo assumption in one place (CLAUDE.md §6.9).
// Bands and refrigeration values are typical figures for illustration, not a quoted standard.

export type ChamberType = "frozen" | "chilled" | "pharma" | "produce";

export interface Band {
  label: string;
  /** Allowed range, °C. */
  lowC: number;
  highC: number;
  setpointC: number;
  /** Typical relative humidity, %. */
  rhPct: number;
}

export const BANDS: Record<ChamberType, Band> = {
  frozen: { label: "Frozen", lowC: -25, highC: -18, setpointC: -21, rhPct: 70 },
  chilled: { label: "Chilled", lowC: 0, highC: 4, setpointC: 2, rhPct: 88 },
  pharma: { label: "Pharma", lowC: 2, highC: 8, setpointC: 5, rhPct: 50 },
  produce: { label: "Fresh produce", lowC: 10, highC: 14, setpointC: 12, rhPct: 90 },
};

/** Normal refrigeration unit readings per chamber type: suction / discharge in bar (gauge), compressor kW. */
export const UNIT_BASE: Record<ChamberType, { suctionBar: number; dischargeBar: number; kw: number }> = {
  frozen: { suctionBar: 1.3, dischargeBar: 17.5, kw: 14 },
  chilled: { suctionBar: 3.6, dischargeBar: 16.8, kw: 9 },
  pharma: { suctionBar: 3.9, dischargeBar: 16.5, kw: 6 },
  produce: { suctionBar: 4.6, dischargeBar: 16.2, kw: 8 },
};

export const KSENSE = {
  thresholds: {
    /** An excursion ends once the temperature is this far back inside the band. */
    excursionHysteresisC: 0.5,
    /** Door-open alarm. Demo timing so the story fits the stand; real sites typically use about 5 minutes. */
    doorOpenAlarmS: 10,
    /** Suction pressure below this share of normal = possible refrigerant leak. */
    suctionLowPct: 80,
    suctionLowClearPct: 85,
    /** Discharge pressure above this = condenser struggling (dirty coil, fan fault, heat). */
    dischargeHighBar: 23,
    /** Freezer room still under this vacuum well after the door closed = relief port iced. */
    reliefStuckPa: -30,
    reliefStuckS: 20,
    lowBatteryPct: 20,
  },
  /** Freezers defrost on a timer. Temperature alarms are held back while a defrost runs. */
  defrost: { everyH: 6, durationMin: 20, pullDownMin: 3, airTempC: -14 },
  /** Room differential pressure, Pa: a freezer pulls this vacuum just after the door closes. */
  roomPa: { freezerAfterClose: -55, freezerSettled: -2, pharmaPositive: 8, iced: -60 },
  /** Random short door openings (normal dock work) so the fleet never looks static. */
  doorEvents: { minIntervalS: 6, maxIntervalS: 14, minOpenS: 3, maxOpenS: 7 },
  /** Live readings kept per chamber for the chart's last few minutes. */
  recentPoints: 120,
} as const;
