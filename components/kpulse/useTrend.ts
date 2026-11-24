"use client";

import { useMemo } from "react";
import { RANGES, trend, type RangeKey } from "@/lib/kpulse/history";
import type { RotatingAsset, SensorPoint, TrendPoint } from "@/lib/kpulse/types";

/**
 * Seeded history for one sensor point plus the live readings since the demo started (or the last
 * few minutes of them). History is recomputed once per step, not every tick.
 */
export function useTrend(a: RotatingAsset, pt: SensorPoint, range: RangeKey, now: number, anchor: number): TrendPoint[] {
  const step = RANGES[range].step;
  const slot = Math.floor(now / step);
  const history = useMemo(
    () => trend(a, pt, slot * step, range, anchor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [a.id, pt, range, slot, anchor],
  );
  const live = a.recent[pt];
  const first = live[0]?.t ?? Number.POSITIVE_INFINITY;
  // On long ranges thin the live tail so it doesn't dominate the line.
  const keep = range === "24h" ? 1 : 4;
  return [...history.filter((p) => p.t < first), ...live.filter((_, i) => i % keep === 0 || i === live.length - 1)];
}
