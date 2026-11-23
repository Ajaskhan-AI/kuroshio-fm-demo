"use client";

import { useMemo, useState } from "react";
import { BUILDINGS } from "@/lib/buildings";
import { fmtAed, fmtKw, fmtKwh, fmtNum, fmtTime } from "@/lib/format";
import { buildingHistory, dubaiDayStart } from "@/lib/sim/generators";
import { useSim } from "@/lib/sim/store";
import type { Alarm, Priority } from "@/lib/types";
import { TopAlert, worstAlarm } from "@/components/alarms/TopAlert";
import { KpiCard, UpdatedAgo } from "@/components/cards/KpiCard";
import { LiveNumber } from "@/components/cards/LiveNumber";
import { Sparkline } from "@/components/cards/Sparkline";
import { StatusChip } from "@/components/cards/StatusChip";
import { UaeMap } from "@/components/map/UaeMap";
import { BuildingCard } from "./BuildingCard";

const SLOT = 15 * 60_000;

export function PortfolioView() {
  const ready = useSim((s) => s.ready);
  const now = useSim((s) => s.now);
  const buildings = useSim((s) => s.buildings);
  const panels = useSim((s) => s.panels);
  const alarms = useSim((s) => s.alarms);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // History only changes every 15 minutes, so recompute per slot, not per tick.
  const slot = Math.floor(now / SLOT);
  const history = useMemo(() => {
    const out: Record<string, number[]> = {};
    const t = slot * SLOT;
    for (const b of Object.values(buildings)) {
      out[b.info.id] = buildingHistory(b.info.id, b.info.type, b.peakKw, t, 24, 60).map((p) => p.kw);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, ready]);

  const peakToday = useMemo(() => {
    if (!ready) return undefined;
    const t = slot * SLOT;
    const start = dubaiDayStart(t);
    const series = Object.values(buildings).map((b) => buildingHistory(b.info.id, b.info.type, b.peakKw, t, 24, 15));
    let best = { t: start, kw: 0 };
    series[0]?.forEach((p, i) => {
      if (p.t < start) return;
      const kw = series.reduce((sum, s) => sum + (s[i]?.kw ?? 0), 0);
      if (kw > best.kw) best = { t: p.t, kw };
    });
    return best.kw > 0 ? best : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, ready]);

  const list = Object.values(buildings);
  const open = alarms.filter((a) => a.status !== "cleared");
  const byPriority: Record<Priority, number> = { P1: 0, P2: 0, P3: 0 };
  open.forEach((a) => byPriority[a.priority]++);

  const topByBuilding = new Map<string, Alarm>();
  for (const b of BUILDINGS) {
    const w = worstAlarm(open.filter((a) => a.buildingId === b.id));
    if (w) topByBuilding.set(b.id, w);
  }

  const ranked = [...list].sort((a, b) => a.health - b.health || b.openAlarms - a.openAlarms || a.info.name.localeCompare(b.info.name));
  const totalKw = list.reduce((s, b) => s + b.kw, 0);
  const totalKwh = list.reduce((s, b) => s + b.kwhToday, 0);
  const totalCost = list.reduce((s, b) => s + b.costTodayAed, 0);
  const allPanels = Object.values(panels);
  const offlinePanels = allPanels.filter((p) => p.status === "offline").length;
  const online = list.filter((b) => b.status !== "offline").length;
  const portfolioTrend = useMemo(() => {
    const ids = Object.keys(history);
    if (!ids.length) return [];
    return history[ids[0]].map((_, i) => ids.reduce((s, id) => s + history[id][i], 0));
  }, [history]);

  if (!ready) return <div className="min-h-[60vh]" aria-busy="true" />;

  return (
    <div className="flex flex-col gap-5">
      <TopAlert alarm={worstAlarm(open)} openCount={open.length} scope="the portfolio" />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard
          title="Buildings online"
          value={
            <span className="tabular-nums">
              {online}
              <span className="text-xl font-semibold text-muted-foreground"> / {list.length}</span>
            </span>
          }
          sub={offlinePanels ? `${offlinePanels} of ${allPanels.length} panels offline` : `All ${allPanels.length} panels reporting`}
          chip={<StatusChip status={offlinePanels ? "warning" : "online"} label={offlinePanels ? "Check" : "Live"} />}
          updatedAt={now}
        />
        <KpiCard
          title="Live load, portfolio"
          value={<LiveNumber value={totalKw} format={fmtKw} />}
          sub={
            peakToday && peakToday.kw > totalKw
              ? `Peak today ${fmtKw(peakToday.kw)} at ${fmtTime(peakToday.t)}`
              : "At today's peak right now"
          }
          trend={<Sparkline data={portfolioTrend} width={96} height={30} label="Portfolio load, last 24 hours" />}
          updatedAt={now}
        />
        <KpiCard
          title="Cost today"
          value={<LiveNumber value={totalCost} format={fmtAed} />}
          sub={<LiveNumber value={totalKwh} format={(v) => `${fmtKwh(v)} since midnight`} />}
          chip={
            <span className="inline-flex h-6 items-center rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground" title="DEWA-style slab tariff plus fuel surcharge. Demo assumption.">
              Demo tariff
            </span>
          }
          updatedAt={now}
        />
        <KpiCard
          title="Open alarms"
          href="/alarms"
          value={<span className={byPriority.P1 ? "tabular-nums text-danger" : "tabular-nums"}>{fmtNum(open.length)}</span>}
          sub={`${byPriority.P1} critical · ${byPriority.P2} high · ${byPriority.P3} normal`}
          chip={<StatusChip status={byPriority.P1 ? "alarm" : open.length ? "warning" : "online"} label={byPriority.P1 ? "Act now" : open.length ? "In hand" : "Clear"} />}
          updatedAt={now}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="font-semibold">Portfolio map</h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="hidden sm:inline">Pin size = load</span>
              <UpdatedAgo at={now} />
            </div>
          </div>
          <UaeMap buildings={buildings} hoveredId={hoveredId} onHover={setHoveredId} />
        </section>

        <section aria-labelledby="ranked-heading" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 id="ranked-heading" className="font-semibold">
              Buildings, worst first
            </h2>
            <span className="text-xs text-muted-foreground">by health score</span>
          </div>
          <ul className="flex flex-col gap-3">
            {ranked.map((b) => (
              <BuildingCard
                key={b.info.id}
                b={b}
                topAlarm={topByBuilding.get(b.info.id)}
                trend={history[b.info.id] ?? []}
                highlighted={hoveredId === b.info.id}
                onHover={setHoveredId}
              />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
