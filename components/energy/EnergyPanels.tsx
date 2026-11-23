"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CheckCircle2, Moon, Server, Wrench } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CONFIG } from "@/lib/config";
import { fmtAedEstimate, fmtKwh, fmtNum, fmtPct, fmtPf, fmtTime } from "@/lib/format";
import { pctChange, type WasteFinding } from "@/lib/energy";
import { pfHistory } from "@/lib/sim/generators";
import { useSim } from "@/lib/sim/store";
import type { BuildingLive, Panel } from "@/lib/types";
import { LiveNumber } from "@/components/cards/LiveNumber";

function Card({ title, aside, children, id }: { title: string; aside?: React.ReactNode; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="flex flex-col rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 id={id} className="font-semibold">
          {title}
        </h2>
        {aside}
      </div>
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

// ---- After-hours waste finder --------------------------------------------------------

const SHOW = 6;

export function WasteFinder({ building, findings, windowLabel }: { building: BuildingLive; findings: WasteFinding[]; windowLabel: string }) {
  const createWorkOrder = useSim((s) => s.createWorkOrder);
  const [created, setCreated] = useState<Record<string, string>>({});
  const [showAll, setShowAll] = useState(false);
  const total = findings.reduce((a, f) => a + f.aedPerMonth, 0);
  const shown = showAll ? findings : findings.slice(0, SHOW);
  const rest = findings.slice(SHOW);

  return (
    <Card
      id="waste-heading"
      title="After-hours waste finder"
      aside={<span className="text-xs text-muted-foreground">Quiet hours {windowLabel}</span>}
    >
      {findings.length ? (
        <>
          <ol className="flex flex-col gap-3">
            {shown.map((f, i) => (
              <li key={f.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-primary tabular-nums">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-semibold">
                        {f.kind === "bms-override" ? <Server className="size-4 text-primary" aria-hidden /> : <Moon className="size-4 text-primary" aria-hidden />}
                        {f.title}
                      </p>
                      <p className="text-sm text-muted-foreground">{f.where}</p>
                      <p className="text-sm">{f.evidence}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold tabular-nums">{fmtAedEstimate(f.aedPerMonth)}</p>
                    <p className="text-xs text-muted-foreground">lost per month</p>
                  </div>
                </div>
                <div className="mt-2 flex justify-end">
                  {f.kind === "bms-override" ? (
                    <Link href={`/buildings/${building.info.id}/bms`} className="inline-flex min-h-11 items-center gap-1 px-2 text-sm font-semibold text-primary hover:underline">
                      See BMS cross-check <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  ) : created[f.id] ? (
                    <Link href={`/alarms#${created[f.id]}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-success-tint px-3 text-sm font-semibold text-success">
                      <Check className="size-4" aria-hidden /> {created[f.id]} created
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const id = createWorkOrder({ buildingId: building.info.id, priority: "P3", title: `Check schedule: ${f.title}`, trade: "Electrical" });
                        setCreated((c) => ({ ...c, [f.id]: id }));
                      }}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold hover:border-primary/50"
                    >
                      <Wrench className="size-4" aria-hidden /> Create work order
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {rest.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-primary hover:underline"
            >
              {showAll ? "Show the top 6 only" : `+${rest.length} smaller loads worth ${fmtAedEstimate(rest.reduce((a, f) => a + f.aedPerMonth, 0))} / month`}
            </button>
          )}
          <p className="mt-3 text-sm">
            Total: <strong className="tabular-nums">{fmtAedEstimate(total)} per month</strong>{" "}
            <span className="text-muted-foreground">at {fmtNum(building.rateAedPerKwh, 2)} AED/kWh. Expected night loads are demo assumptions.</span>
          </p>
        </>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-5 text-success" aria-hidden /> Nothing significant running after hours.
        </p>
      )}
    </Card>
  );
}

// ---- Breakdown by SMDB ----------------------------------------------------------------

export function SmdbBreakdown({ building, panels }: { building: BuildingLive; panels: Panel[] }) {
  const total = panels.reduce((a, p) => a + p.incomer.kwhToday, 0) || 1;
  const max = Math.max(...panels.map((p) => p.incomer.kwhToday), 1);
  return (
    <Card id="breakdown-heading" title="Breakdown by floor / SMDB" aside={<span className="text-xs text-muted-foreground">energy today</span>}>
      <ul className="flex flex-col gap-1">
        {panels.map((p) => (
          <li key={p.id}>
            <Link
              href={`/buildings/${building.info.id}/smdb?panel=${p.name}`}
              className="grid min-h-11 grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-accent"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{p.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{p.location}</span>
              </span>
              <span className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span className="block h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${(p.incomer.kwhToday / max) * 100}%` }} />
              </span>
              <span className="w-28 text-right text-sm tabular-nums">
                <LiveNumber value={p.incomer.kwhToday} format={fmtKwh} className="font-semibold" />
                <span className="block text-xs text-muted-foreground">{fmtPct((p.incomer.kwhToday / total) * 100)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---- Power factor ----------------------------------------------------------------------

const SLOT = 15 * 60_000;

export function PfTrend({ building, livePf, now }: { building: BuildingLive; livePf: number; now: number }) {
  const slot = Math.floor(now / SLOT);
  const hist = useMemo(
    () => pfHistory(building.info.id, building.info.type, slot * SLOT),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [building.info.id, slot],
  );
  const data = [...hist, { t: now, pf: livePf }];
  const t = CONFIG.pfPenaltyThreshold;
  const below = data.filter((d) => d.pf < t).length;

  return (
    <Card id="pf-heading" title="Power factor, last 24 hours" aside={<span className="text-sm font-semibold tabular-nums">Now {fmtPf(livePf)}</span>}>
      <div className="h-56 w-full" role="img" aria-label="Building power factor over 24 hours against the penalty threshold">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(x: number) => fmtTime(x)} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} stroke="var(--border)" minTickGap={24} />
            <YAxis domain={[0.84, 1]} ticks={[0.85, 0.9, 0.95, 1]} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} stroke="var(--border)" width={44} tickFormatter={(v: number) => v.toFixed(2)} />
            <Tooltip
              labelFormatter={(x) => fmtTime(Number(x))}
              formatter={(v) => [fmtPf(Number(v)), "Power factor"]}
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)", fontSize: 13 }}
              labelStyle={{ color: "var(--muted-foreground)" }}
            />
            <ReferenceLine y={t} stroke="var(--danger)" strokeDasharray="5 4" label={{ value: `Penalty below ${t.toFixed(2)}`, position: "insideBottomRight", fill: "var(--danger)", fontSize: 11 }} />
            <Line dataKey="pf" type="monotone" stroke="var(--primary)" strokeWidth={2.25} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {below ? `Below ${t.toFixed(2)} for about ${fmtNum(below * 15)} min in the last 24 h.` : `Stayed above ${t.toFixed(2)} all day.`} Threshold is a demo assumption.
      </p>
    </Card>
  );
}

// ---- Comparisons and tariff -----------------------------------------------------------

export interface ComparisonRow {
  label: string;
  now: number;
  before: number;
  beforeLabel: string;
}

function Delta({ now, before }: { now: number; before: number }) {
  const pct = pctChange(now, before);
  const flat = Math.abs(pct) < 0.5;
  return (
    <span className="whitespace-nowrap text-sm font-semibold tabular-nums">
      {flat ? "≈ same" : `${pct < 0 ? "▼" : "▲"} ${fmtPct(Math.abs(pct), 1)} ${pct < 0 ? "lower" : "higher"}`}
    </span>
  );
}

export function ComparisonCard({ rows, building }: { rows: ComparisonRow[]; building: BuildingLive }) {
  const { slabs, fuelSurchargeFils } = CONFIG.tariff;
  return (
    <Card id="compare-heading" title="Compared with before">
      <table className="w-full text-sm">
        <caption className="sr-only">Energy compared with earlier periods</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-border last:border-0">
              <th scope="row" className="py-2.5 pr-2 text-left align-top font-medium">
                {r.label}
                <span className="block text-xs font-normal text-muted-foreground">
                  vs {r.beforeLabel}: {fmtKwh(r.before)}
                </span>
              </th>
              <td className="py-2.5 pr-2 text-right align-top tabular-nums">{fmtKwh(r.now)}</td>
              <td className="py-2.5 text-right align-top">
                <Delta now={r.now} before={r.before} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">Tariff used (demo assumption, editable)</p>
        <p className="mt-1">
          {CONFIG.tariff.label}:{" "}
          {slabs.map((s, i) => {
            const from = i === 0 ? 0 : slabs[i - 1].upToKwh + 1;
            const range = Number.isFinite(s.upToKwh) ? `${fmtNum(from)}–${fmtNum(s.upToKwh)}` : `above ${fmtNum(from - 1)}`;
            return (
              <span key={i}>
                {i > 0 && " · "}
                <span className="whitespace-nowrap">
                  {range} kWh {s.fils} fils
                </span>
              </span>
            );
          })}
          , plus {fuelSurchargeFils} fils fuel surcharge. Blended rate for this building:{" "}
          <strong className="text-foreground">{fmtNum(building.rateAedPerKwh, 3)} AED/kWh</strong>.
        </p>
      </div>
    </Card>
  );
}
