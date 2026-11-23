"use client";

import { useMemo, useState } from "react";
import { Leaf } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BUILDINGS } from "@/lib/buildings";
import { CONFIG } from "@/lib/config";
import { pctChange } from "@/lib/energy";
import { fmtMwh, fmtNum, fmtPct, fmtTco2e } from "@/lib/format";
import { carbonByMonth, carbonRows } from "@/lib/report";
import type { BuildingLive } from "@/lib/types";
import { ChipGroup } from "@/components/cards/ChipGroup";
import { KpiCard } from "@/components/cards/KpiCard";
import { LiveNumber } from "@/components/cards/LiveNumber";

const SLOT = 15 * 60_000;

function change(now: number, before: number) {
  const pct = pctChange(now, before);
  if (Math.abs(pct) < 0.5) return "About the same as last month";
  return `${pct < 0 ? "▼" : "▲"} ${fmtPct(Math.abs(pct), 1)} vs same days last month`;
}

export function CarbonSection({ buildings, now }: { buildings: BuildingLive[]; now: number }) {
  const [scope, setScope] = useState<string>("all");
  const slot = Math.floor(now / SLOT);
  const key = buildings.map((b) => b.info.id).join();
  const tick10s = Math.floor(now / 10_000);

  // History-heavy sums move per 15-minute slot; live MTD rows are recomputed each tick (cheap).
  const months = useMemo(
    () => carbonByMonth(buildings, slot * SLOT),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, slot],
  );
  const rows = useMemo(
    () => carbonRows(buildings, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, slot, tick10s],
  );

  const mtd = rows.reduce((a, r) => a + r.mtdT, 0);
  const lastSame = rows.reduce((a, r) => a + r.lastMonthSameT, 0);
  const ytd = rows.reduce((a, r) => a + r.ytdT, 0);
  const mwh = rows.reduce((a, r) => a + r.mtdKwh, 0) / 1000;
  const chart = months.map((m) => ({ label: m.label, partial: m.partial, t: scope === "all" ? m.total : (m.byBuilding[scope] ?? 0) }));
  const factor = CONFIG.emissionFactor.tCo2ePerMwh;

  return (
    <section aria-labelledby="carbon-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="carbon-heading" className="flex items-center gap-2 text-lg font-semibold">
          <Leaf className="size-5 text-primary" aria-hidden /> Scope 2 carbon
        </h2>
        <p className="text-sm text-muted-foreground">
          Metered kWh × grid factor. <strong className="text-foreground">Factor used: {fmtNum(factor, 2)} tCO₂e/MWh</strong> (configurable, demo assumption)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard title="This month so far" value={<LiveNumber value={mtd} format={fmtTco2e} />} sub={change(mtd, lastSame)} updatedAt={now} />
        <KpiCard title="Year to date" value={fmtTco2e(ytd)} sub="All six buildings" updatedAt={now} />
        <KpiCard title="Metered energy, month" value={<LiveNumber value={mwh} format={fmtMwh} />} sub="Every kWh from the meters, no estimates" updatedAt={now} />
        <KpiCard title="Grid factor" value={`${fmtNum(factor, 2)}`} sub="tCO₂e per MWh · edit in config" updatedAt={now} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h3 className="font-semibold">Monthly tCO₂e, last 12 months</h3>
            <span className="text-xs text-muted-foreground">* month to date</span>
          </div>
          <div className="p-4">
            <ChipGroup
              label="Building"
              value={scope}
              onChange={setScope}
              className="mb-3 [&>span]:hidden"
              options={[{ value: "all", label: "Portfolio" }, ...BUILDINGS.map((b) => ({ value: b.id, label: b.short }))]}
            />
            <div className="h-64 w-full" role="img" aria-label="Monthly Scope 2 emissions over the last 12 months">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} stroke="var(--border)" interval={0} />
                  <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} stroke="var(--border)" width={48} tickFormatter={(v: number) => fmtNum(v)} />
                  <Tooltip
                    formatter={(v) => [fmtTco2e(Number(v)), "Scope 2"]}
                    cursor={{ fill: "var(--muted)" }}
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)", fontSize: 13 }}
                    labelStyle={{ color: "var(--muted-foreground)" }}
                  />
                  <Bar dataKey="t" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                    {chart.map((d) => (
                      <Cell key={d.label} fill={d.partial ? "var(--primary-light)" : "var(--primary)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-semibold">By building, this month</h3>
          </div>
          <div className="no-scrollbar overflow-x-auto p-4">
            <table className="w-full min-w-[380px] text-sm">
              <caption className="sr-only">Scope 2 emissions by building</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-2 font-medium">Building</th>
                  <th scope="col" className="py-2 pr-2 text-right font-medium">Month</th>
                  <th scope="col" className="py-2 pr-2 text-right font-medium">vs last</th>
                  <th scope="col" className="py-2 text-right font-medium">Year</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const pct = pctChange(r.mtdT, r.lastMonthSameT);
                  return (
                    <tr key={r.building.info.id} className="border-b border-border last:border-0">
                      <th scope="row" className="py-2.5 pr-2 text-left font-medium">
                        {r.building.info.name}
                      </th>
                      <td className="py-2.5 pr-2 text-right tabular-nums">{fmtNum(r.mtdT, 1)} t</td>
                      <td className="py-2.5 pr-2 text-right tabular-nums text-muted-foreground">
                        {Math.abs(pct) < 0.5 ? "same" : `${pct < 0 ? "▼" : "▲"} ${fmtPct(Math.abs(pct))}`}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{fmtNum(r.ytdT)} t</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
