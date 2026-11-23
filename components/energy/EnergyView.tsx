"use client";

import { useMemo } from "react";
import { ArrowDown, Moon } from "lucide-react";
import { CONFIG } from "@/lib/config";
import { afterHoursWindow, buildingPf, dubaiMonth, findWaste, pctChange, pfRisk } from "@/lib/energy";
import { fmtAed, fmtAedEstimate, fmtDate, fmtKw, fmtKwh, fmtPct, fmtPf, fmtTime } from "@/lib/format";
import { DAY, buildingHistory, dayKwh, dubaiDayStart, kwhSinceMidnight } from "@/lib/sim/generators";
import { useSim } from "@/lib/sim/store";
import { KpiCard } from "@/components/cards/KpiCard";
import { LiveNumber } from "@/components/cards/LiveNumber";
import { StatusChip } from "@/components/cards/StatusChip";
import { ComparisonCard, PfTrend, SmdbBreakdown, WasteFinder, type ComparisonRow } from "./EnergyPanels";
import { LoadProfileChart } from "./LoadProfileChart";

const SLOT = 15 * 60_000;

function deltaText(pct: number, what: string) {
  if (Math.abs(pct) < 0.5) return `About the same as ${what}`;
  return `${pct < 0 ? "▼" : "▲"} ${fmtPct(Math.abs(pct), 1)} vs ${what}`;
}

export function EnergyView({ buildingId }: { buildingId: string }) {
  const ready = useSim((s) => s.ready);
  const now = useSim((s) => s.now);
  const building = useSim((s) => s.buildings[buildingId]);
  const panelIds = useSim((s) => s.panelIds[buildingId]);
  const panelsById = useSim((s) => s.panels);
  const points = useSim((s) => s.bmsPoints[buildingId]);

  const panels = useMemo(() => (panelIds ?? []).map((id) => panelsById[id]), [panelIds, panelsById]);
  const slot = Math.floor(now / SLOT);

  // Waste: history-based findings change per 15-min slot; the BMS ones are live.
  const findings = useMemo(
    () => (building && points ? findWaste(building, panels, points, slot * SLOT) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [building?.info.id, slot, points],
  );

  const model = useMemo(() => {
    if (!building) return null;
    const { id, type } = building.info;
    const t = slot * SLOT;
    const today = dubaiDayStart(t);
    const sinceMidnight = buildingHistory(id, type, building.peakKw, t, 24, 15).filter((p) => p.t >= today);
    const peakToday = sinceMidnight.reduce((b, p) => (p.kw > b.kw ? p : b), { t: today, kw: 0 });

    const { start: mStart, days: mDays } = dubaiMonth(t);
    const { start: lmStart } = dubaiMonth(t, 1);
    const elapsedDays = Math.round((today - mStart) / DAY);
    let mtdPrior = 0;
    let lastMonthSame = 0;
    let monthPeak = { day: today, kw: 0 };
    for (let d = 0; d < elapsedDays; d++) {
      const day = mStart + d * DAY;
      mtdPrior += dayKwh(id, type, building.peakKw, day);
      lastMonthSame += dayKwh(id, type, building.peakKw, lmStart + d * DAY);
      const hist = buildingHistory(id, type, building.peakKw, day + DAY - 1, 24, 60);
      const pk = Math.max(...hist.map((h) => h.kw));
      if (pk > monthPeak.kw) monthPeak = { day, kw: pk };
    }
    let week = 0;
    let prevWeek = 0;
    for (let d = 1; d <= 7; d++) week += dayKwh(id, type, building.peakKw, today - d * DAY);
    for (let d = 8; d <= 14; d++) prevWeek += dayKwh(id, type, building.peakKw, today - d * DAY);

    return {
      peakToday,
      mtdPrior,
      lastMonthSame,
      monthPeak,
      mDays,
      elapsedDays,
      week,
      prevWeek,
      lastWeekSoFar: kwhSinceMidnight(id, type, building.peakKw, now - 7 * DAY),
      lastMonthTodaySoFar: kwhSinceMidnight(id, type, building.peakKw, lmStart + elapsedDays * DAY + (now - today)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building?.info.id, slot]);

  if (!ready || !building || !points || !model) return <div className="min-h-[60vh]" aria-busy="true" />;

  const rate = building.rateAedPerKwh;
  const quiet = afterHoursWindow(building.info.type);
  const wasteTotal = findings.reduce((a, f) => a + f.aedPerMonth, 0);
  const vsLastWeek = pctChange(building.kwhToday, model.lastWeekSoFar);
  const peakNow = building.kw > model.peakToday.kw;
  const peak = peakNow ? { t: now, kw: building.kw } : model.peakToday;
  const mtdKwh = model.mtdPrior + building.kwhToday;
  const projected = (mtdKwh / (model.elapsedDays + (now - dubaiDayStart(now)) / DAY)) * model.mDays * rate;
  const pf = buildingPf(panels);
  const risk = pfRisk(pf);

  const rows: ComparisonRow[] = [
    { label: "Today so far", now: building.kwhToday, before: model.lastWeekSoFar, beforeLabel: "same time last week" },
    { label: "Last 7 days", now: model.week, before: model.prevWeek, beforeLabel: "the 7 days before" },
    {
      label: "Month to date",
      now: mtdKwh,
      before: model.lastMonthSame + model.lastMonthTodaySoFar,
      beforeLabel: "same days last month",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Status first: the money on the table. */}
      {findings.length === 0 ? (
        <p className="flex min-h-14 items-center gap-3 rounded-xl border border-success/30 bg-success-tint px-4 py-3 text-sm font-medium">
          <Moon className="size-5 shrink-0 text-success" aria-hidden />
          No avoidable after-hours waste found in {building.info.name} right now.
        </p>
      ) : (
      <a
        href="#waste-heading"
        className="group flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-primary/30 bg-accent px-4 py-3 text-sm text-foreground hover:border-primary"
      >
        <Moon className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="font-bold">
          <LiveNumber value={wasteTotal} format={(v) => `${fmtAedEstimate(v)} / month`} /> of avoidable waste found
        </span>
        <span className="text-muted-foreground">
          {findings.length} {findings.length === 1 ? "load" : "loads"} running when {building.info.name} should be quiet
        </span>
        <span className="ml-auto inline-flex items-center gap-1 font-semibold text-primary">
          See the list <ArrowDown className="size-4 transition-transform group-hover:translate-y-0.5" aria-hidden />
        </span>
      </a>
      )}

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard
          title="Energy today"
          value={<LiveNumber value={building.kwhToday} format={fmtKwh} />}
          sub={deltaText(vsLastWeek, "same time last week")}
          updatedAt={now}
        />
        <KpiCard
          title="Cost today"
          value={<LiveNumber value={building.kwhToday * rate} format={fmtAed} />}
          sub={`Month so far ${fmtAed(mtdKwh * rate)} · heading for ${fmtAedEstimate(projected)}`}
          chip={<span className="inline-flex h-6 items-center rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">Demo tariff</span>}
          updatedAt={now}
        />
        <KpiCard
          title="Peak demand today"
          value={<LiveNumber value={peak.kw} format={fmtKw} />}
          sub={`${peakNow ? "Right now" : `At ${fmtTime(peak.t)}`} · month peak ${fmtKw(model.monthPeak.kw)} on ${fmtDate(model.monthPeak.day)}`}
          updatedAt={now}
        />
        <KpiCard
          title="Power factor"
          value={fmtPf(pf)}
          sub={`Penalty risk below ${CONFIG.pfPenaltyThreshold.toFixed(2)}`}
          chip={<StatusChip status={risk === "high" ? "alarm" : risk === "watch" ? "warning" : "online"} label={risk === "high" ? "High risk" : risk === "watch" ? "Watch" : "Low risk"} />}
          updatedAt={now}
        />
      </div>

      <LoadProfileChart building={building} now={now} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <WasteFinder building={building} findings={findings} windowLabel={quiet.label} />
        <SmdbBreakdown building={building} panels={panels} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <PfTrend building={building} livePf={pf} now={now} />
        <ComparisonCard rows={rows} building={building} />
      </div>
    </div>
  );
}
