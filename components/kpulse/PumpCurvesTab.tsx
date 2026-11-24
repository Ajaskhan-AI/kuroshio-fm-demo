"use client";

import { useMemo } from "react";
import { CartesianGrid, ComposedChart, Line, LineChart, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { Gauge, Waves } from "lucide-react";
import { KPULSE } from "@/lib/kpulse/config";
import { dailySpecificEnergy, pumpSamples } from "@/lib/kpulse/history";
import { etaAt, headOnCurve, maxVelocity, npshaAt, npshrAt, pumpKw } from "@/lib/kpulse/physics";
import { energyLostAedMonth } from "@/lib/kpulse/rules";
import type { RotatingAsset } from "@/lib/kpulse/types";
import { fmtAedEstimate, fmtDate, fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatusChip } from "@/components/cards/StatusChip";
import { ChartFrame, LegendLine, LegendSwatch, SERIES, TICK, TOOLTIP_STYLE } from "./charts";

const T = KPULSE.thresholds;

/** The live operating point: a dot with a soft pulse so the eye finds it at once. */
function LiveDot(props: { cx?: number; cy?: number; fill?: string }) {
  const { cx = 0, cy = 0, fill = "var(--primary)" } = props;
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill={fill} opacity={0.25}>
        <animate attributeName="r" values="8;16;8" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.35;0;0.35" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={7} fill={fill} stroke="var(--card)" strokeWidth={2} />
    </g>
  );
}

function TrailDot(props: { cx?: number; cy?: number }) {
  const { cx = 0, cy = 0 } = props;
  return <circle cx={cx} cy={cy} r={3.5} fill="var(--chart-4)" fillOpacity={0.45} />;
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: React.ReactNode; tone?: "warn" | "bad" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 text-xl font-bold tabular-nums", tone === "bad" && "text-danger", tone === "warn" && "text-warning")}>{value}</dd>
      {sub && <dd className="text-xs text-muted-foreground">{sub}</dd>}
    </div>
  );
}

export function PumpCurvesTab({ asset: a, anchor }: { asset: RotatingAsset; anchor: number }) {
  const p = a.pump!;
  const r = a.readings.pump;
  const s = a.op.speed;
  const qMax = p.qBep * 1.55;

  // History depends only on the asset and the demo start, not on the live tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const samples = useMemo(() => pumpSamples(a, anchor), [a.id, anchor]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const energy = useMemo(() => dailySpecificEnergy(a, anchor), [a.id, anchor]);
  // Curves change only with speed; round it so they are not rebuilt on every tick.
  const sKey = Math.round(s * 100) / 100;
  const curves = useMemo(() => {
    const out = [];
    for (let i = 0; i <= 40; i++) {
      const q = (qMax * i) / 40;
      const x = q / (p.qBep * sKey);
      out.push({
        q,
        rated: headOnCurve(p, q, 1),
        atSpeed: q <= p.qBep * sKey * 1.5 ? headOnCurve(p, q, sKey) : undefined,
        eta: x >= 0.05 && x <= 1.6 ? etaAt(p, x) * 100 : undefined,
        kw: x >= 0.2 && x <= 1.5 ? pumpKw(p, q, sKey) : undefined,
        npshr: npshrAt(p, x, sKey),
        npsha: npshaAt(p, q),
      });
    }
    return out;
  }, [p, qMax, sKey]);

  if (!r) {
    return <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">The pump is not running: no operating point to show.</p>;
  }

  const live = [{ q: r.flowM3h, h: r.headM, eta: r.eta * 100, kw: a.readings.kw, bep: r.bepPct, v: maxVelocity(a.readings) }];
  // Past points corrected to today's speed with the affinity laws (Q ∝ n, H ∝ n², P ∝ n³), so they compare with the curve shown.
  const trail = samples
    .filter((_, i) => i % 6 === 3)
    .map((x) => {
      const k = s / x.speed;
      return { q: x.q * k, h: x.h * k * k, kw: x.kw * k ** 3, eta: x.eta * 100 };
    });
  const scatter = samples.map((x) => ({ bep: (x.q / (p.qBep * x.speed)) * 100, v: x.v }));
  const margin = r.npshaM - r.npshrM;
  const lost = energyLostAedMonth(a, a.readings, a.op, a.sev);
  const bepLo = (T.bepLowPct / 100) * p.qBep * s;
  const bepHi = (T.bepHighPct / 100) * p.qBep * s;
  // Flow where the NPSH margin hits the warning and alarm limits (the risk zone starts here).
  const crossAt = (limit: number) => curves.find((c) => c.npsha - c.npshr < limit)?.q;
  const warnQ = crossAt(T.npshMarginWarnM);
  const alarmQ = crossAt(T.npshMarginAlarmM);
  const outOfBand = r.bepPct < T.bepLowPct || r.bepPct > T.bepHighPct;
  const fmtQ = (v: number) => `${fmtNum(v)} m³/h`;
  const axisQ = { dataKey: "q", type: "number" as const, domain: [0, Math.round(qMax)], tick: TICK, stroke: "var(--border)", tickFormatter: (v: number) => fmtNum(v), unit: "" };

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="Flow"
          value={fmtQ(r.flowM3h)}
          sub={
            <span className="inline-flex items-center gap-1">
              {p.flowSource === "virtual" ? <Waves className="size-3" aria-hidden /> : <Gauge className="size-3" aria-hidden />}
              {p.flowSource === "virtual" ? "Virtual flow meter (AI estimate)" : "Flow meter"}
            </span>
          }
        />
        <Kpi label="Head" value={`${fmtNum(r.headM, 1)} m`} sub={`${fmtNum(r.suctionBar, 2)} → ${fmtNum(r.dischargeBar, 2)} bar`} />
        <Kpi label="Share of BEP flow" value={`${fmtNum(r.bepPct)} %`} sub={`Healthy ${T.bepLowPct}–${T.bepHighPct} %`} tone={outOfBand ? "warn" : undefined} />
        <Kpi label="Pump efficiency" value={`${fmtNum(r.eta * 100)} %`} sub={`${fmtNum(p.etaBep * 100)} % at BEP`} tone={r.eta < p.etaBep * 0.85 ? "warn" : undefined} />
        <Kpi
          label="NPSH margin"
          value={`${fmtNum(margin, 1)} m`}
          sub={margin < T.npshMarginAlarmM ? "Cavitation risk: high" : margin < T.npshMarginWarnM ? "Cavitation risk: medium" : "Cavitation risk: low"}
          tone={margin < T.npshMarginAlarmM ? "bad" : margin < T.npshMarginWarnM ? "warn" : undefined}
        />
        <Kpi label="Energy lost" value={fmtAedEstimate(lost)} sub="Per month vs running at BEP" tone={lost > 300 ? "warn" : undefined} />
      </dl>

      <ChartFrame
        title="Head against flow (H–Q)"
        sub={`Factory curve at rated speed, the same curve at today's ${fmtNum(s * 100)} % speed, and where the pump really runs. Dots below the curve mean wear.`}
        legend={
          <>
            <LegendLine color="var(--muted-foreground)" label="Factory curve, 100 % speed" dashed />
            <LegendLine color={SERIES[0]} label={`Curve at ${fmtNum(s * 100)} % speed`} />
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-chart-4/50" aria-hidden /> Last 30 days (at today&apos;s speed)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-primary" aria-hidden /> Now
            </span>
            <LegendSwatch fill="var(--success)" label="Best-efficiency band" opacity={0.15} />
          </>
        }
      >
        <div className="h-72 w-full" role="img" aria-label={`Pump curve. Operating now at ${fmtQ(r.flowM3h)} and ${fmtNum(r.headM, 1)} m, ${fmtNum(r.bepPct)} % of best-efficiency flow.`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={curves} margin={{ top: 8, right: 12, bottom: 14, left: -6 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <ReferenceArea x1={bepLo} x2={bepHi} fill="var(--success)" fillOpacity={0.08} stroke="none" />
              <XAxis {...axisQ} label={{ value: "Flow, m³/h", position: "insideBottom", offset: -8, fill: "var(--muted-foreground)", fontSize: 12 }} />
              <YAxis type="number" domain={[0, Math.ceil(p.h0 * 1.1)]} tick={TICK} stroke="var(--border)" width={44} />
              <Tooltip formatter={(v, n) => [`${fmtNum(Number(v), 1)} m`, String(n)]} labelFormatter={(q) => fmtQ(Number(q))} {...TOOLTIP_STYLE} />
              <Line dataKey="rated" name="Factory curve" stroke="var(--muted-foreground)" strokeDasharray="6 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line dataKey="atSpeed" name="At current speed" stroke={SERIES[0]} strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls={false} />
              <ReferenceDot x={p.qBep * s} y={headOnCurve(p, p.qBep * s, s)} r={5} fill="var(--card)" stroke={SERIES[0]} strokeWidth={2} label={{ value: "BEP", position: "top", fill: "var(--muted-foreground)", fontSize: 11 }} />
              <Scatter data={trail} dataKey="h" name="Last 30 days" shape={<TrailDot />} isAnimationActive={false} />
              <Scatter data={live} dataKey="h" name="Now" shape={<LiveDot fill={outOfBand ? "var(--warning)" : "var(--primary)"} />} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title="NPSH: cavitation margin"
          sub="When NPSH available falls to NPSH required, the pump cavitates. Keep at least 1 m between them."
          legend={
            <>
              <LegendLine color={SERIES[0]} label="NPSH available" />
              <LegendLine color="var(--danger)" label="NPSH required" />
              <LegendSwatch fill="var(--warning)" label="Margin under 1 m" />
              <LegendSwatch fill="var(--danger)" label="Under 0.5 m" />
            </>
          }
        >
          <div className="h-56 w-full" role="img" aria-label={`NPSH margin ${fmtNum(margin, 1)} m at the current flow`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curves} margin={{ top: 8, right: 12, bottom: 0, left: -6 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                {warnQ !== undefined && <ReferenceArea x1={warnQ} x2={alarmQ ?? qMax} fill="var(--warning)" fillOpacity={0.12} stroke="none" />}
                {alarmQ !== undefined && <ReferenceArea x1={alarmQ} x2={qMax} fill="var(--danger)" fillOpacity={0.12} stroke="none" />}
                <XAxis {...axisQ} />
                <YAxis domain={[0, Math.ceil(Math.max(p.npshaStatic, p.npshrBep * 1.6) + 1)]} tick={TICK} stroke="var(--border)" width={44} />
                <Tooltip formatter={(v, n) => [`${fmtNum(Number(v), 1)} m`, String(n)]} labelFormatter={(q) => fmtQ(Number(q))} {...TOOLTIP_STYLE} />
                <Line dataKey="npsha" name="NPSH available" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="npshr" name="NPSH required" stroke="var(--danger)" strokeWidth={2} dot={false} isAnimationActive={false} />
                <ReferenceLine
                  x={r.flowM3h}
                  stroke="var(--foreground)"
                  strokeDasharray="4 3"
                  label={{ value: `Now · margin ${fmtNum(margin, 1)} m`, position: r.flowM3h > qMax * 0.55 ? "insideTopRight" : "insideTopLeft", fill: "var(--foreground)", fontSize: 11 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartFrame>

        <ChartFrame
          title="Efficiency against flow"
          sub="Peaks at the best-efficiency point. Running away from it wastes energy."
          legend={
            <>
              <LegendLine color={SERIES[0]} label="Pump efficiency" />
              <LegendSwatch fill="var(--success)" label={`Healthy band ${T.bepLowPct}–${T.bepHighPct} % of BEP`} opacity={0.15} />
            </>
          }
        >
          <div className="h-56 w-full" role="img" aria-label={`Efficiency ${fmtNum(r.eta * 100)} % now, ${fmtNum(p.etaBep * 100)} % at BEP`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={curves} margin={{ top: 8, right: 12, bottom: 0, left: -6 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <ReferenceArea x1={bepLo} x2={bepHi} fill="var(--success)" fillOpacity={0.1} stroke="none" />
                <XAxis {...axisQ} />
                <YAxis domain={[0, 100]} tick={TICK} stroke="var(--border)" width={52} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip formatter={(v, n) => [`${fmtNum(Number(v))} %`, String(n)]} labelFormatter={(q) => fmtQ(Number(q))} {...TOOLTIP_STYLE} />
                <Line dataKey="eta" name="Efficiency" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Scatter data={live} dataKey="eta" name="Now" shape={<LiveDot fill={outOfBand ? "var(--warning)" : "var(--primary)"} />} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartFrame>

        <ChartFrame
          title="Power against flow"
          sub="Factory power curve at today's speed against what the motor really draws."
          legend={
            <>
              <LegendLine color={SERIES[0]} label="Expected (factory)" />
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-chart-4/50" aria-hidden /> Measured, last 30 days
              </span>
            </>
          }
        >
          <div className="h-56 w-full" role="img" aria-label={`Power draw ${fmtNum(a.readings.kw, 1)} kW now`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={curves} margin={{ top: 8, right: 12, bottom: 0, left: -6 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis {...axisQ} />
                <YAxis domain={[0, Math.ceil(a.ratedKw * 1.15)]} tick={TICK} stroke="var(--border)" width={44} />
                <ReferenceLine y={a.ratedKw} stroke="var(--muted-foreground)" strokeDasharray="5 4" label={{ value: `Motor ${a.ratedKw} kW`, position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 11 }} />
                <Tooltip formatter={(v, n) => [`${fmtNum(Number(v), 1)} kW`, String(n)]} labelFormatter={(q) => fmtQ(Number(q))} {...TOOLTIP_STYLE} />
                <Line dataKey="kw" name="Expected" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Scatter data={trail} dataKey="kw" name="Measured" shape={<TrailDot />} isAnimationActive={false} />
                <Scatter data={live} dataKey="kw" name="Now" shape={<LiveDot />} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartFrame>

        <ChartFrame
          title="Vibration against flow"
          sub="Vibration is lowest near the best-efficiency point and rises either side of it."
          legend={
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-chart-4/50" aria-hidden /> Every 4 h, last 30 days
              </span>
              <LegendSwatch fill="var(--success)" label="Healthy band" opacity={0.15} />
            </>
          }
        >
          <div className="h-56 w-full" role="img" aria-label="Scatter of vibration against share of best-efficiency flow">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart margin={{ top: 8, right: 12, bottom: 0, left: -6 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <ReferenceArea x1={T.bepLowPct} x2={T.bepHighPct} fill="var(--success)" fillOpacity={0.1} stroke="none" />
                <XAxis dataKey="bep" type="number" domain={[40, 150]} ticks={[40, 60, 80, 100, 120, 140]} tick={TICK} stroke="var(--border)" tickFormatter={(v: number) => `${v}%`} />
                <YAxis dataKey="v" type="number" domain={[0, "auto"]} tick={TICK} stroke="var(--border)" width={44} />
                <Tooltip formatter={(v, n) => [n === "bep" ? `${fmtNum(Number(v))} % of BEP` : `${fmtNum(Number(v), 1)} mm/s`, n === "bep" ? "Flow" : "Velocity"]} {...TOOLTIP_STYLE} />
                <Scatter data={scatter} shape={<TrailDot />} isAnimationActive={false} />
                <Scatter data={live} shape={<LiveDot fill={outOfBand ? "var(--warning)" : "var(--primary)"} />} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartFrame>
      </div>

      <ChartFrame
        title="Specific energy: kWh per m³ pumped"
        sub="The simplest health number for a pump. Rising means more electricity for the same water."
        legend={
          <>
            <LegendLine color={SERIES[0]} label="Daily kWh/m³" />
            <StatusChip status={outOfBand ? "warning" : "online"} label={`Now ${fmtNum(a.readings.kw / Math.max(1, r.flowM3h), 3)} kWh/m³`} />
          </>
        }
      >
        <div className="h-44 w-full" role="img" aria-label="Daily specific energy over 30 days">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={energy} margin={{ top: 8, right: 12, bottom: 0, left: -6 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(t: number) => fmtDate(t)} tick={TICK} stroke="var(--border)" minTickGap={32} />
              <YAxis domain={[(lo: number) => Math.floor(lo * 0.97 * 1000) / 1000, (hi: number) => Math.ceil(hi * 1.03 * 1000) / 1000]} tickCount={4} tick={TICK} stroke="var(--border)" width={52} tickFormatter={(v: number) => fmtNum(v, 3)} />
              <Tooltip formatter={(v) => [`${fmtNum(Number(v), 3)} kWh/m³`, "Specific energy"]} labelFormatter={(t) => fmtDate(Number(t))} {...TOOLTIP_STYLE} />
              <Line dataKey="kwhPerM3" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>
    </div>
  );
}
