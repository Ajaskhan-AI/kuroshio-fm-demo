"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtNum, fmtTime } from "@/lib/format";
import { chwHistory } from "@/lib/sim/generators";
import type { BmsPoint, BuildingLive } from "@/lib/types";

const SLOT = 15 * 60_000;

/** 24 h chilled-water supply vs return temperature, with the live reading appended. */
export function ChwTrendChart({ building, points, now }: { building: BuildingLive; points: BmsPoint[]; now: number }) {
  const slot = Math.floor(now / SLOT);
  const history = useMemo(
    () => chwHistory(building.info.id, building.info.type, slot * SLOT),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [building.info.id, slot],
  );
  const supply = points.find((p) => p.equipment === "Chiller-1" && p.name === "CHW supply temp")?.value;
  const ret = points.find((p) => p.equipment === "Chiller-1" && p.name === "CHW return temp")?.value;
  const data = supply !== undefined && ret !== undefined ? [...history, { t: now, supply, ret }] : history;
  const last = data[data.length - 1];

  return (
    <section aria-labelledby="chw-heading" className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 id="chw-heading" className="font-semibold">
          Chilled water, last 24 hours
        </h2>
        <span className="text-sm tabular-nums text-muted-foreground">
          Now {fmtNum(last.supply, 1)} °C → {fmtNum(last.ret, 1)} °C · ΔT {fmtNum(last.ret - last.supply, 1)} °C
        </span>
      </div>
      <div className="p-4">
        <div className="h-64 w-full" role="img" aria-label="Chilled water supply and return temperature over 24 hours">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(t: number) => fmtTime(t)}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                stroke="var(--border)"
                minTickGap={24}
              />
              <YAxis
                domain={[4, 16]}
                ticks={[4, 6, 8, 10, 12, 14, 16]}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                stroke="var(--border)"
                width={44}
                tickFormatter={(v: number) => `${v}°`}
              />
              <Tooltip
                labelFormatter={(t) => fmtTime(Number(t))}
                formatter={(v) => `${fmtNum(Number(v), 1)} °C`}
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)", fontSize: 13 }}
                labelStyle={{ color: "var(--muted-foreground)" }}
              />
              <Line dataKey="supply" name="CHW supply" type="monotone" stroke="var(--primary)" strokeWidth={2.25} dot={false} isAnimationActive={false} />
              <Line dataKey="ret" name="CHW return" type="monotone" stroke="var(--chart-2)" strokeWidth={2.25} strokeDasharray="6 3" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-primary" aria-hidden /> Supply (Chiller-1)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0 w-4 border-t-2 border-dashed border-chart-2" aria-hidden /> Return
          </span>
        </p>
      </div>
    </section>
  );
}
