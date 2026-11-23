"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BANDS } from "@/lib/ksense/config";
import { HISTORY_SLOT, chamberHistory } from "@/lib/ksense/history";
import type { Chamber } from "@/lib/ksense/types";
import { fmtNum, fmtTime } from "@/lib/format";

/** 24 h temperature with the allowed band shaded and defrost cycles marked; live readings appended. */
export function ChamberChart({ chamber: c, now }: { chamber: Chamber; now: number }) {
  const band = BANDS[c.type];
  const slot = Math.floor(now / HISTORY_SLOT);
  const history = useMemo(
    () => chamberHistory(c, slot * HISTORY_SLOT),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c.id, slot],
  );
  const firstLive = c.recent[0]?.t ?? Number.POSITIVE_INFINITY;
  const data = [...history.filter((p) => p.t < firstLive).map((p) => ({ t: p.t, c: p.c })), ...c.recent];

  // Contiguous defrost windows, drawn as shaded bands.
  const defrosts = useMemo(() => {
    const out: [number, number][] = [];
    for (const p of history) {
      if (!p.defrost) continue;
      const last = out[out.length - 1];
      if (last && p.t - last[1] <= HISTORY_SLOT) last[1] = p.t;
      else out.push([p.t, p.t]);
    }
    return out;
  }, [history]);

  const values = data.map((p) => p.c);
  const lo = Math.floor(Math.min(band.lowC - 1, ...values));
  const hi = Math.ceil(Math.max(band.highC + 2, ...values));

  return (
    <div>
      <div className="h-56 w-full" role="img" aria-label={`${c.name} temperature over 24 hours against the allowed range ${band.lowC} to ${band.highC} °C`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <ReferenceArea y1={band.lowC} y2={band.highC} fill="var(--success)" fillOpacity={0.08} stroke="none" ifOverflow="hidden" />
            {defrosts.map(([a, b]) => (
              <ReferenceArea key={a} x1={a} x2={b + HISTORY_SLOT} fill="var(--offline)" fillOpacity={0.18} stroke="none" ifOverflow="hidden" />
            ))}
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(t: number) => fmtTime(t)}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              stroke="var(--border)"
              minTickGap={28}
            />
            <YAxis
              domain={[lo, hi]}
              allowDecimals={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              stroke="var(--border)"
              width={44}
              tickFormatter={(v: number) => `${v}°`}
            />
            <Tooltip
              labelFormatter={(t) => fmtTime(Number(t))}
              formatter={(v) => [`${fmtNum(Number(v), 1)} °C`, "Temperature"]}
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)", fontSize: 13 }}
              labelStyle={{ color: "var(--muted-foreground)" }}
            />
            <Line dataKey="c" type="monotone" stroke="var(--primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-primary" aria-hidden /> Air temperature
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-success/20" aria-hidden /> Allowed range {band.lowC} to {band.highC} °C
        </span>
        {defrosts.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-offline/30" aria-hidden /> Defrost (alarms held)
          </span>
        )}
      </p>
    </div>
  );
}
