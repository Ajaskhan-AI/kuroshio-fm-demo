"use client";

import { useMemo, useState } from "react";
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtAed, fmtDate, fmtKw, fmtKwh, fmtNum, fmtTime } from "@/lib/format";
import { DAY, buildingHistory, dailyHistory, dubaiWeekday } from "@/lib/sim/generators";
import type { BuildingLive } from "@/lib/types";
import { ChipGroup } from "@/components/cards/ChipGroup";

const SLOT = 15 * 60_000;
const axisTick = { fill: "var(--muted-foreground)", fontSize: 12 };
const tooltipStyle = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)", fontSize: 13 },
  labelStyle: { color: "var(--muted-foreground)" },
};

export function LoadProfileChart({ building, now }: { building: BuildingLive; now: number }) {
  const [range, setRange] = useState<"24h" | "30d">("24h");
  const { id, type } = building.info;
  const slot = Math.floor(now / SLOT);

  const day = useMemo(() => {
    const t = slot * SLOT;
    const today = buildingHistory(id, type, building.peakKw, t, 24, 15);
    const lastWeek = buildingHistory(id, type, building.peakKw, t - 7 * DAY, 24, 15);
    return today.map((p, i) => ({ t: p.t, kw: p.kw, lastWeek: lastWeek[i]?.kw }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, slot]);

  const month = useMemo(
    () => dailyHistory(id, type, building.peakKw, slot * SLOT, 30).map((d) => ({ ...d, weekend: [0, 6].includes(dubaiWeekday(d.day + 12 * 3_600_000)) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, slot],
  );

  const dayData = [...day, { t: now, kw: building.kw, lastWeek: undefined as number | undefined }];
  const peak = dayData.reduce((best, p) => (p.kw > best.kw ? p : best), dayData[0]);

  return (
    <section aria-labelledby="profile-heading" className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 id="profile-heading" className="font-semibold">
          Load profile
        </h2>
        <ChipGroup
          label="Range"
          value={range}
          onChange={setRange}
          className="[&>span]:hidden"
          options={[
            { value: "24h", label: "24 hours" },
            { value: "30d", label: "30 days" },
          ]}
        />
      </div>
      <div className="p-4">
        {range === "24h" ? (
          <>
            <p className="mb-2 text-sm text-muted-foreground">
              Peak in the last 24 h: <strong className="text-foreground">{fmtKw(peak.kw)}</strong> at {fmtTime(peak.t)}
            </p>
            <div className="h-72 w-full" role="img" aria-label={`${building.info.name} load over the last 24 hours, compared with the same day last week`}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dayData} margin={{ top: 12, right: 8, bottom: 0, left: -4 }}>
                  <defs>
                    <linearGradient id="kfm-load" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(t: number) => fmtTime(t)} tick={axisTick} stroke="var(--border)" minTickGap={24} />
                  <YAxis tick={axisTick} stroke="var(--border)" width={52} tickFormatter={(v: number) => fmtNum(v)} />
                  <Tooltip labelFormatter={(t) => fmtTime(Number(t))} formatter={(v) => fmtKw(Number(v))} {...tooltipStyle} />
                  <Line dataKey="lastWeek" name="Same day last week" type="monotone" stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />
                  <Area dataKey="kw" name="Load" type="monotone" stroke="var(--primary)" strokeWidth={2.25} fill="url(#kfm-load)" isAnimationActive={false} />
                  <ReferenceDot x={peak.t} y={peak.kw} r={5} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} label={{ value: "Peak", position: "top", fill: "var(--foreground)", fontSize: 12 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-4 rounded-sm bg-primary" aria-hidden /> Load (kW)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0 w-4 border-t-2 border-dashed border-muted-foreground" aria-hidden /> Same day last week
              </span>
            </p>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm text-muted-foreground">
              Daily energy, last 30 days. Total <strong className="text-foreground">{fmtKwh(month.reduce((a, d) => a + d.kwh, 0))}</strong>
            </p>
            <div className="h-72 w-full" role="img" aria-label={`${building.info.name} daily energy over the last 30 days`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={month} margin={{ top: 12, right: 8, bottom: 0, left: -4 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tickFormatter={(t: number) => fmtDate(t)} tick={axisTick} stroke="var(--border)" minTickGap={16} />
                  <YAxis tick={axisTick} stroke="var(--border)" width={52} tickFormatter={(v: number) => `${fmtNum(v / 1000)}k`} />
                  <Tooltip
                    labelFormatter={(t) => fmtDate(Number(t))}
                    formatter={(v) => [`${fmtKwh(Number(v))} · ${fmtAed(Number(v) * building.rateAedPerKwh)}`, "Energy"]}
                    cursor={{ fill: "var(--muted)" }}
                    {...tooltipStyle}
                  />
                  <Bar dataKey="kwh" name="Energy" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                    {month.map((d) => (
                      <Cell key={d.day} fill={d.weekend ? "var(--primary-light)" : "var(--primary)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-3 rounded-sm bg-primary" aria-hidden /> Weekday
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-3 rounded-sm bg-primary-light" aria-hidden /> Weekend (Sat–Sun)
              </span>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
