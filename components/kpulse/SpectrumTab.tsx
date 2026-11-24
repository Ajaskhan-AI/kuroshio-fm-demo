"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { noSeverities, spectrum, spectrumMaxHz, spectrumPeaks } from "@/lib/kpulse/physics";
import { pointLabel } from "@/lib/kpulse/selectors";
import { noise } from "@/lib/sim/random";
import type { Observation, RotatingAsset, SensorPoint } from "@/lib/kpulse/types";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChartFrame, LegendLine, LegendSwatch, SERIES, TICK, TOOLTIP_STYLE } from "./charts";

/** What each marker means, in plain words, for the list under the chart. */
const MEANING: Record<string, string> = {
  "1x": "Running speed: unbalance shows here",
  "2x": "Twice running speed: misalignment",
  "3x": "Harmonics: looseness or misalignment",
  "100hz": "2 × line frequency: motor electrical",
  bpfo: "Outer-race bearing defect",
  bpfi: "Inner-race bearing defect",
  vane: "Impeller vanes passing the cutwater",
  lobe: "Screw rotor lobes meshing",
  subsync: "Below running speed: surge / flow instability",
  blade: "Fan blades passing",
  belt: "Drive belt",
};

export function SpectrumTab({ asset: a, point, open }: { asset: RotatingAsset; point: SensorPoint; open: Observation[] }) {
  const [compare, setCompare] = useState(true);
  // Severities rounded so the spectrum isn't rebuilt on every tick, only when the condition moves.
  const key = Object.values(a.sev).map((v) => v.toFixed(2)).join(",") + `|${a.op.duty.toFixed(2)}|${a.op.speed.toFixed(2)}|${a.op.running}`;
  const data = useMemo(() => {
    const seeded = (bin: number) => noise(a.id, "spec", bin);
    const now = spectrum(a, a.sev, a.op, seeded);
    const base = spectrum(a, noSeverities(), { ...a.op, running: true, duty: a.kind === "pump" ? 1 : a.op.duty }, (bin) => noise(a.id, "base", bin));
    return now.map((p, i) => ({ hz: p.hz, v: p.v, base: base[i].v }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id, key]);
  const maxHz = spectrumMaxHz(a);
  const peaks = spectrumPeaks(a, a.sev, a.op).filter((p) => p.marker && p.hz <= maxHz);
  const used = new Set(open.filter((o) => o.assetId === a.id).flatMap((o) => o.markers));
  // Stack labels of markers that sit close together into rows so they never overlap.
  const narrow = typeof window !== "undefined" && window.innerWidth < 640;
  const minGap = maxHz / (narrow ? 6 : 14);
  const lastInRow: number[] = [];
  const labelled = [...peaks]
    .sort((x, y) => x.hz - y.hz)
    .map((p) => {
      let row = 0;
      while (lastInRow[row] !== undefined && p.hz - lastInRow[row] < minGap) row++;
      lastInRow[row] = p.hz;
      return { p, row };
    });
  const broadband = used.has("broadband");
  const top = Math.max(0.8, ...data.map((d) => Math.max(d.v, compare ? d.base : 0)));
  const f1 = (a.rpm * a.op.speed) / 60;

  if (!a.op.running) {
    return <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">The machine is not running: no spectrum to capture.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={compare}
          onClick={() => setCompare(!compare)}
          className={cn(
            "inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm font-medium",
            compare ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50",
          )}
        >
          Compare with healthy baseline
        </button>
        <span className="text-xs text-muted-foreground">
          Captured at {pointLabel(a, point)} · running speed {fmtNum(f1, 1)} Hz ({fmtNum(a.rpm * a.op.speed)} rpm)
        </span>
      </div>

      <ChartFrame
        title="Velocity spectrum (FFT)"
        sub="Each fault shows up at its own frequency. Markers the AI used for its diagnosis are highlighted."
        legend={
          <>
            <LegendLine color={SERIES[0]} label="Now" />
            {compare && <LegendLine color="var(--muted-foreground)" label="Healthy baseline" dashed />}
            <LegendLine color="var(--danger)" label="Marker used by the AI" dashed />
            {broadband && <LegendSwatch fill="var(--danger)" label="Broadband noise (cavitation)" opacity={0.15} />}
          </>
        }
      >
        <div className="h-80 w-full" role="img" aria-label={`Velocity spectrum from 0 to ${maxHz} Hz with ${peaks.length} fault-frequency markers`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 22 + 13 * Math.max(0, ...lastInRow.map((_, i) => i)), right: 12, bottom: 14, left: -6 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              {broadband && <ReferenceArea x1={110} x2={maxHz} fill="var(--danger)" fillOpacity={0.07} stroke="none" />}
              <XAxis
                dataKey="hz"
                type="number"
                domain={[0, maxHz]}
                tick={TICK}
                stroke="var(--border)"
                label={{ value: "Frequency, Hz", position: "insideBottom", offset: -8, fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <YAxis domain={[0, Math.ceil(top * 1.15 * 10) / 10]} tick={TICK} stroke="var(--border)" width={44} tickFormatter={(v: number) => fmtNum(v, 1)} />
              {labelled.map(({ p, row }) => {
                const hot = used.has(p.key);
                return (
                  <ReferenceLine
                    key={p.key}
                    x={p.hz}
                    stroke={hot ? "var(--danger)" : "var(--muted-foreground)"}
                    strokeOpacity={hot ? 0.9 : 0.35}
                    strokeDasharray="4 3"
                    label={(props: { viewBox?: { x?: number; y?: number } }) => (
                      <text
                        x={props.viewBox?.x ?? 0}
                        y={(props.viewBox?.y ?? 0) - 6 - row * 13}
                        textAnchor="middle"
                        fontSize={11}
                        fontWeight={hot ? 700 : 400}
                        fill={hot ? "var(--danger)" : "var(--muted-foreground)"}
                      >
                        {p.label}
                      </text>
                    )}
                  />
                );
              })}
              <Tooltip
                labelFormatter={(hz) => `${fmtNum(Number(hz))} Hz`}
                formatter={(v, n) => [`${fmtNum(Number(v), 2)} mm/s`, n === "base" ? "Healthy baseline" : "Now"]}
                {...TOOLTIP_STYLE}
              />
              <Area dataKey="v" name="v" type="linear" stroke={SERIES[0]} strokeWidth={1.5} fill={SERIES[0]} fillOpacity={0.15} isAnimationActive={false} />
              {compare && <Line dataKey="base" name="base" type="linear" stroke="var(--muted-foreground)" strokeDasharray="4 3" strokeWidth={1.2} dot={false} isAnimationActive={false} />}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">Fault frequencies on this machine</h3>
        <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {peaks.map((p) => {
            const hot = used.has(p.key);
            return (
              <li key={p.key} className="flex flex-wrap items-baseline gap-x-2 border-b border-border/60 py-1 last:border-0 sm:flex-nowrap sm:border-0 sm:py-0">
                <span className={cn("w-20 shrink-0 font-semibold", hot && "text-danger")}>{p.label}</span>
                <span className="w-16 shrink-0 tabular-nums text-muted-foreground">{fmtNum(p.hz, 1)} Hz</span>
                <span className="order-last basis-full text-xs text-muted-foreground sm:order-none sm:min-w-0 sm:flex-1 sm:basis-auto sm:text-sm">{MEANING[p.key] ?? ""}</span>
                <span className={cn("ml-auto tabular-nums", hot && "font-bold text-danger")}>{fmtNum(p.amp, 2)} mm/s</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
