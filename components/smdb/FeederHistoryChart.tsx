"use client";

import { useMemo } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtA, fmtKw, fmtTime } from "@/lib/format";
import { feederHistory } from "@/lib/sim/generators";
import { avg3 } from "@/lib/sim/selectors";
import type { BuildingLive, Feeder, Panel } from "@/lib/types";

const SLOT = 15 * 60_000;

/** Last 24 h of one feeder: kW (area, left axis) and average current against the breaker rating (right axis). */
export function FeederHistoryChart({ building, panel, feeder, now }: { building: BuildingLive; panel: Panel; feeder: Feeder; now: number }) {
  const slot = Math.floor(now / SLOT);
  const history = useMemo(
    () =>
      feederHistory({ id: building.info.id, type: building.info.type, peakKw: building.peakKw }, panel.share, feeder, slot * SLOT),
    // History only moves every 15 minutes; live values are appended below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [building.info.id, panel.id, feeder.id, slot],
  );
  const data = [...history, { t: now, kw: feeder.kw, a: avg3(feeder.i) }];
  const maxA = Math.max(feeder.ratedA * 1.1, ...data.map((d) => d.a));

  return (
    <div className="h-64 w-full md:h-72" role="img" aria-label={`${feeder.name}: load and current over the last 24 hours`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="kfm-kw" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t: number) => fmtTime(t)}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            stroke="var(--border)"
            tickCount={7}
            minTickGap={24}
          />
          <YAxis
            yAxisId="kw"
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            stroke="var(--border)"
            tickFormatter={(v: number) => `${Math.round(v)}`}
            width={48}
            label={{ value: "kW", angle: -90, position: "insideLeft", offset: 14, fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            yAxisId="a"
            orientation="right"
            domain={[0, Math.ceil(maxA / 10) * 10]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            stroke="var(--border)"
            width={44}
            label={{ value: "A", angle: 90, position: "insideRight", offset: 12, fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <ReferenceLine
            yAxisId="a"
            y={feeder.ratedA}
            stroke="var(--danger)"
            strokeDasharray="5 4"
            label={{ value: `Breaker ${feeder.ratedA} A`, position: "insideTopRight", fill: "var(--danger)", fontSize: 11 }}
          />
          <Tooltip
            labelFormatter={(t) => fmtTime(Number(t))}
            formatter={(v, name) => (name === "Load" ? fmtKw(Number(v)) : fmtA(Number(v)))}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)", fontSize: 13 }}
            labelStyle={{ color: "var(--muted-foreground)" }}
          />
          <Area yAxisId="kw" dataKey="kw" name="Load" type="monotone" stroke="var(--primary)" strokeWidth={2} fill="url(#kfm-kw)" isAnimationActive={false} />
          <Line yAxisId="a" dataKey="a" name="Current (avg)" type="monotone" stroke="var(--chart-2)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
