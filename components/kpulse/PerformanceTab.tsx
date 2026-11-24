"use client";

import { useState } from "react";
import { CONFIG } from "@/lib/config";
import { KPULSE } from "@/lib/kpulse/config";
import { RANGES, type RangeKey } from "@/lib/kpulse/history";
import { energyLostAedMonth } from "@/lib/kpulse/rules";
import type { RotatingAsset, SensorPoint } from "@/lib/kpulse/types";
import { fmtAedEstimate, fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChipGroup } from "@/components/cards/ChipGroup";
import { ChartFrame, LegendLine, SERIES, TrendChart } from "./charts";
import { useTrend } from "./useTrend";

function Kpi({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 text-xl font-bold tabular-nums", warn && "text-warning")}>{value}</dd>
      {sub && <dd className="text-xs text-muted-foreground">{sub}</dd>}
    </div>
  );
}

/** Compressors and fans: what the machine delivers for the power it takes. */
export function PerformanceTab({ asset: a, point, now, anchor }: { asset: RotatingAsset; point: SensorPoint; now: number; anchor: number }) {
  const [range, setRange] = useState<RangeKey>("30d");
  const data = useTrend(a, point, range, now, anchor);
  const multiDay = range !== "24h";
  const r = a.readings;
  const lost = energyLostAedMonth(a, r, a.op, a.sev);
  const ratedA = (a.ratedKw * 1000) / (Math.sqrt(3) * CONFIG.electrical.voltageLL * 0.87 * KPULSE.physics.motorEfficiency);
  const c = a.compressor;
  const spUnit = c?.service === "air" ? "kW per m³/min" : "kW/TR";

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="Power" value={`${fmtNum(r.kw, 1)} kW`} sub={`Motor rated ${a.ratedKw} kW`} />
        <Kpi label="Current" value={`${fmtNum(r.currentA)} A`} sub={`Power factor ${fmtNum(r.pf, 2)}`} warn={r.pf < 0.84} />
        {c && r.compressor ? (
          <Kpi
            label="Specific power"
            value={`${fmtNum(r.compressor.specificPower, 2)}`}
            sub={`${spUnit} · design ${fmtNum(c.designSpecificPower, 2)}`}
            warn={r.compressor.specificPower > c.designSpecificPower * 1.08}
          />
        ) : (
          <Kpi label="Load" value={`${fmtNum(a.op.duty * 100)} %`} sub={a.vfd ? `VFD at ${fmtNum(a.op.speed * 100)} % speed` : "Fixed speed"} />
        )}
        <Kpi label="Energy lost" value={fmtAedEstimate(lost)} sub="Per month, from faults" warn={lost > 300} />
      </dl>

      <ChipGroup label="Range" value={range} onChange={setRange} options={(Object.keys(RANGES) as RangeKey[]).map((k) => ({ value: k, label: RANGES[k].label }))} />

      {c ? (
        <>
          <ChartFrame title={`Specific power (${spUnit})`} sub="Electricity per unit of cooling or air. Creeping up means the machine is working harder for the same job." legend={<LegendLine color={SERIES[0]} label="Specific power" />}>
            <TrendChart
              data={data}
              series={[{ key: "sp", label: "Specific power", color: SERIES[0] }]}
              unit={spUnit}
              decimals={2}
              yMin="auto"
              limits={[{ y: c.designSpecificPower, label: "Design", color: "var(--muted-foreground)" }]}
              multiDay={multiDay}
              ariaLabel="Specific power trend"
            />
          </ChartFrame>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartFrame title="Load" legend={<LegendLine color={SERIES[0]} label="Load, %" />}>
              <TrendChart data={data} series={[{ key: "load", label: "Load", color: SERIES[0] }]} unit="%" decimals={0} yMax={100} multiDay={multiDay} height={200} ariaLabel="Compressor load trend" />
            </ChartFrame>
            {c.style === "centrifugal" ? (
              <ChartFrame title="Surge margin" sub="Distance from the surge line. Under 10 % the flow can reverse." legend={<LegendLine color={SERIES[0]} label="Surge margin, %" />}>
                <TrendChart
                  data={data}
                  series={[{ key: "surge", label: "Surge margin", color: SERIES[0] }]}
                  unit="%"
                  limits={[{ y: KPULSE.thresholds.surgeMarginWarnPct, label: "Warning", color: "var(--warning)" }]}
                  multiDay={multiDay}
                  height={200}
                  ariaLabel="Surge margin trend"
                />
              </ChartFrame>
            ) : c.service === "air" ? (
              <ChartFrame title="Load / unload cycles per hour" sub="Many short cycles wear the inlet valve and motor contactor." legend={<LegendLine color={SERIES[0]} label="Cycles per hour" />}>
                <TrendChart data={data} series={[{ key: "cycles", label: "Cycles", color: SERIES[0] }]} unit="/h" decimals={0} multiDay={multiDay} height={200} ariaLabel="Load and unload cycles trend" />
              </ChartFrame>
            ) : (
              <ChartFrame title="Motor current" legend={<LegendLine color={SERIES[0]} label="Current, A" />}>
                <TrendChart data={data} series={[{ key: "currentA", label: "Current", color: SERIES[0] }]} unit="A" decimals={0} multiDay={multiDay} height={200} ariaLabel="Motor current trend" />
              </ChartFrame>
            )}
          </div>
        </>
      ) : (
        <>
          <ChartFrame title="Motor current" sub="Against the motor's full-load current." legend={<LegendLine color={SERIES[0]} label="Current, A" />}>
            <TrendChart
              data={data}
              series={[{ key: "currentA", label: "Current", color: SERIES[0] }]}
              unit="A"
              decimals={0}
              limits={[{ y: ratedA, label: "Full-load current", color: "var(--muted-foreground)" }]}
              multiDay={multiDay}
              ariaLabel="Motor current trend"
            />
          </ChartFrame>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartFrame title="Power" legend={<LegendLine color={SERIES[0]} label="kW" />}>
              <TrendChart data={data} series={[{ key: "kw", label: "Power", color: SERIES[0] }]} unit="kW" multiDay={multiDay} height={200} ariaLabel="Power trend" />
            </ChartFrame>
            <ChartFrame title="Power factor" legend={<LegendLine color={SERIES[0]} label="Power factor" />}>
              <TrendChart data={data} series={[{ key: "pf", label: "Power factor", color: SERIES[0] }]} unit="" decimals={2} yMin={0.7} yMax={1} multiDay={multiDay} height={200} ariaLabel="Power factor trend" />
            </ChartFrame>
          </div>
        </>
      )}
    </div>
  );
}
