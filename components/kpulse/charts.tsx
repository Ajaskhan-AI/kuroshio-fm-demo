"use client";

import type { ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/lib/kpulse/types";
import { fmtDate, fmtNum, fmtTime } from "@/lib/format";

export const TOOLTIP_STYLE = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)", fontSize: 13 },
  labelStyle: { color: "var(--muted-foreground)" },
} as const;

export const TICK = { fill: "var(--muted-foreground)", fontSize: 12 } as const;

/** Chart series colours that read in both themes: brand blue and slate; a third series is drawn dashed. */
export const SERIES = ["var(--chart-1)", "var(--chart-4)"] as const;

export interface SeriesDef {
  key: keyof TrendPoint;
  label: string;
  color: string;
  dashed?: boolean;
}

export interface Band {
  from: number;
  to: number;
  fill: string;
  opacity: number;
  label?: string;
}

export function ChartFrame({ title, sub, children, legend }: { title: string; sub?: ReactNode; children: ReactNode; legend?: ReactNode }) {
  return (
    <section className="flex flex-col rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      <div className="mt-3">{children}</div>
      {legend && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{legend}</div>}
    </section>
  );
}

export function LegendLine({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-0 w-4 border-t-2" style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }} aria-hidden /> {label}
    </span>
  );
}

export function LegendSwatch({ fill, label, opacity = 0.25 }: { fill: string; label: string; opacity?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block size-3 rounded-sm" style={{ background: fill, opacity }} aria-hidden /> {label}
    </span>
  );
}

/** A time-series chart over one sensor point, with optional shaded bands and limit lines. */
export function TrendChart({
  data,
  series,
  unit,
  decimals = 1,
  bands = [],
  limits = [],
  yMin = 0,
  yMax,
  multiDay,
  height = 220,
  ariaLabel,
}: {
  data: TrendPoint[];
  series: SeriesDef[];
  unit: string;
  decimals?: number;
  bands?: Band[];
  limits?: { y: number; label: string; color: string }[];
  yMin?: number | "auto";
  yMax?: number;
  multiDay: boolean;
  height?: number;
  ariaLabel: string;
}) {
  const values = data.flatMap((p) => series.map((s) => Number(p[s.key] ?? 0)));
  const top = Math.max(yMax ?? 0, ...values, ...limits.map((l) => l.y * 1.05));
  const max = Math.ceil(top * 1.06 * 10) / 10 || 1;
  // Small spans need a decimal on the ticks, or labels repeat ("3, 3, 4").
  const span = max - (typeof yMin === "number" ? yMin : Math.min(...values, ...limits.map((l) => l.y)));
  const tickDecimals = span < 1 ? 2 : span < 5 ? 1 : 0;
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -10 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          {bands.map((b) => (
            <ReferenceArea key={`${b.from}-${b.to}`} y1={b.from} y2={Math.min(b.to, max)} fill={b.fill} fillOpacity={b.opacity} stroke="none" ifOverflow="hidden" />
          ))}
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t: number) => (multiDay ? fmtDate(t) : fmtTime(t))}
            tick={TICK}
            stroke="var(--border)"
            minTickGap={32}
          />
          <YAxis domain={[yMin === "auto" ? "auto" : yMin, max]} tick={TICK} stroke="var(--border)" width={44} tickFormatter={(v: number) => fmtNum(v, tickDecimals)} />
          {limits.map((l) => (
            <ReferenceLine key={l.label} y={l.y} stroke={l.color} strokeDasharray="5 4" ifOverflow="extendDomain" label={{ value: l.label, position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 11 }} />
          ))}
          <Tooltip
            labelFormatter={(t) => `${multiDay ? `${fmtDate(Number(t))} ` : ""}${fmtTime(Number(t))}`}
            formatter={(v, name) => [`${fmtNum(Number(v), decimals)} ${unit}`, String(name)]}
            {...TOOLTIP_STYLE}
          />
          {series.map((s) => (
            <Line key={String(s.key)} dataKey={s.key as string} name={s.label} type="monotone" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? "5 4" : undefined} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
