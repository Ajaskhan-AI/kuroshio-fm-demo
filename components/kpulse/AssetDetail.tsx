"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, AudioWaveform, BarChart3, Gauge, Sparkles, TrendingUp } from "lucide-react";
import { getBuilding } from "@/lib/buildings";
import { KPULSE, ZONE_TEXT } from "@/lib/kpulse/config";
import { dailyHealth } from "@/lib/kpulse/history";
import { attentionPoint, maxOf, maxVelocity, pointVelocity, zoneOf } from "@/lib/kpulse/physics";
import { assetStatus, daysToAlertLimit, openObservations, pointLabel, sortObservations, zoneStatus } from "@/lib/kpulse/selectors";
import { usePulse } from "@/lib/kpulse/store";
import type { RotatingAsset, SensorPoint } from "@/lib/kpulse/types";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { UpdatedAgo } from "@/components/cards/KpiCard";
import { Sparkline } from "@/components/cards/Sparkline";
import { StatusChip } from "@/components/cards/StatusChip";
import { HealthRing } from "./HealthRing";
import { MachineDiagram } from "./MachineDiagram";
import { ObservationCard, ObservationList } from "./Observations";
import { PerformanceTab } from "./PerformanceTab";
import { PumpCurvesTab } from "./PumpCurvesTab";
import { SpectrumTab } from "./SpectrumTab";
import { VibrationTab } from "./VibrationTab";

type Tab = "overview" | "vibration" | "curves" | "spectrum" | "ai";
const T = KPULSE.thresholds;

function Reading({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" | "bad" }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 text-xl font-bold tabular-nums", tone === "bad" && "text-danger", tone === "warn" && "text-warning")}>{value}</dd>
      {sub && <dd className="text-xs text-muted-foreground">{sub}</dd>}
    </div>
  );
}

export function AssetDetail({ asset: a }: { asset: RotatingAsset }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const now = usePulse((s) => s.now);
  const anchor = usePulse((s) => s.anchor);
  const assets = usePulse((s) => s.assets);
  const observations = usePulse((s) => s.observations);
  // Follow whichever point needs attention (it moves during the incident) until someone picks one.
  const [picked, setPoint] = useState<SensorPoint | null>(null);
  const point = picked ?? attentionPoint(a, a.readings);

  const open = useMemo(() => openObservations(observations), [observations]);
  const mine = open.filter((o) => o.assetId === a.id);
  const history = sortObservations(observations.filter((o) => o.assetId === a.id && o.status === "cleared"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const daily = useMemo(() => dailyHealth(a, anchor), [a.id, anchor]);
  const status = assetStatus(a, open);
  const days = daysToAlertLimit(a.health, [...daily, a.health]);
  const building = getBuilding(a.buildingId);

  const tabs: { key: Tab; label: string; icon: typeof Activity }[] = [
    { key: "overview", label: "Overview", icon: Gauge },
    { key: "vibration", label: "Vibration", icon: Activity },
    { key: "curves", label: a.kind === "pump" ? "Pump curves" : "Performance", icon: TrendingUp },
    { key: "spectrum", label: "Spectrum", icon: AudioWaveform },
    { key: "ai", label: `AI observations${mine.length ? ` (${mine.length})` : ""}`, icon: Sparkles },
  ];
  const requested = params.get("tab") as Tab | null;
  const tab: Tab = tabs.some((t) => t.key === requested) ? requested! : "overview";
  const setTab = (t: Tab) => {
    const q = new URLSearchParams(params.toString());
    q.set("tab", t);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  const pr = a.readings.points[point];
  const v = maxVelocity(a.readings);
  const zone = zoneOf(v, a.iso);
  const temp = maxOf(a.readings, "tempC");
  const hf = maxOf(a.readings, "hfG");
  const kurt = maxOf(a.readings, "kurtosis");
  const pump = a.readings.pump;
  const margin = pump ? pump.npshaM - pump.npshrM : undefined;

  return (
    <section aria-labelledby="asset-heading" className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4 md:p-5">
        <HealthRing value={a.health} status={status.status} size={72} />
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-xs font-medium text-muted-foreground">
            {building?.name} · {a.location}
          </p>
          <h2 id="asset-heading" className="text-xl font-bold">
            {a.tag} · {a.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {a.typeLabel} · {a.ratedKw} kW · {fmtNum(a.rpm)} rpm{a.vfd ? ` · VFD at ${fmtNum(a.op.speed * 100)} %` : " · fixed speed"}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:flex-col sm:items-end">
          <StatusChip status={status.status} label={status.label} />
          <StatusChip status={a.tripped ? "offline" : zoneStatus[zone]} label={a.tripped ? "Not running" : ZONE_TEXT[zone]} />
          <UpdatedAgo at={a.updatedAt} />
        </div>
      </header>

      <div role="tablist" aria-label="Asset views" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
        {tabs.map((t) => {
          const Icon = t.icon;
          const on = t.key === tab;
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors",
                on ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden /> {t.label}
            </button>
          );
        })}
      </div>

      {tab !== "overview" && tab !== "ai" && (
        <div role="group" aria-label="Sensor point" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {(["motor-nde", "motor-de", "machine-de", "machine-nde"] as SensorPoint[]).map((pt) => {
            const on = pt === point;
            const pv = pointVelocity(a.readings.points[pt]);
            return (
              <button
                key={pt}
                type="button"
                aria-pressed={on}
                onClick={() => setPoint(pt)}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium",
                  on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50",
                )}
              >
                {pointLabel(a, pt)}
                <span className={cn("rounded-full px-1.5 text-xs tabular-nums", on ? "bg-white/20" : "bg-muted text-muted-foreground")}>{fmtNum(pv, 1)}</span>
              </button>
            );
          })}
        </div>
      )}

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold">Sensor points</h3>
              <p className="text-xs text-muted-foreground">Letter = ISO zone at that point. Tap one to see it in the charts.</p>
              <MachineDiagram asset={a} selected={point} onSelect={setPoint} />
              <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Reading label={`Velocity · ${pointLabel(a, point)}`} value={`${fmtNum(pointVelocity(pr), 1)} mm/s`} sub={`X ${fmtNum(pr.vx, 1)} · Y ${fmtNum(pr.vy, 1)} · Z ${fmtNum(pr.vz, 1)}`} />
                <Reading label="HF / envelope" value={`${fmtNum(pr.hfG, 2)} gE`} sub={`Accel ${fmtNum(pr.accelG, 2)} g`} tone={pr.hfG > T.hfAlarm ? "bad" : pr.hfG > T.hfWarn ? "warn" : undefined} />
                <Reading label="Kurtosis" value={fmtNum(pr.kurtosis, 1)} sub={`Crest factor ${fmtNum(pr.crest, 1)}`} tone={pr.kurtosis > T.kurtosisWarn ? "warn" : undefined} />
                <Reading label="Temperature" value={`${fmtNum(pr.tempC)} °C`} sub="Bearing housing" tone={pr.tempC > T.tempAlarmC ? "bad" : pr.tempC > T.tempWarnC ? "warn" : undefined} />
              </dl>
            </div>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Reading label="Worst velocity" value={`${fmtNum(v, 1)} mm/s`} sub={a.tripped ? "Not running" : ZONE_TEXT[zone]} tone={zone === "D" ? "bad" : zone === "C" ? "warn" : undefined} />
              {pump && margin !== undefined ? (
                <Reading label="NPSH margin" value={`${fmtNum(margin, 1)} m`} sub={`Flow ${fmtNum(pump.bepPct)} % of BEP`} tone={margin < T.npshMarginAlarmM ? "bad" : margin < T.npshMarginWarnM ? "warn" : undefined} />
              ) : (
                <Reading label="Hottest bearing" value={`${fmtNum(temp)} °C`} sub={`HF max ${fmtNum(hf, 2)} gE`} tone={temp > T.tempWarnC ? "warn" : undefined} />
              )}
              <Reading label="Power" value={`${fmtNum(a.readings.kw, 1)} kW`} sub={`${fmtNum(a.readings.currentA)} A · PF ${fmtNum(a.readings.pf, 2)}`} />
              <Reading
                label="Days to alert limit"
                value={days === null ? "Stable" : days === 0 ? "Now" : `${fmtNum(days)} days`}
                sub={days === null ? "No downward trend" : `At the 10-day rate, to health ${T.healthAlertLimit}`}
                tone={days !== null && days < 14 ? "warn" : undefined}
              />
            </dl>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Health, last 30 days</h3>
                <span className="text-xs tabular-nums text-muted-foreground">Kurtosis max {fmtNum(kurt, 1)}</span>
              </div>
              <Sparkline data={[...daily, a.health]} width={600} height={56} className={cn("mt-2 w-full", status.status === "alarm" ? "text-danger" : "text-primary")} label="Health score over 30 days" />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" aria-hidden /> AI observations
            </h3>
            {mine.length ? (
              mine.map((o) => <ObservationCard key={o.id} obs={o} now={now} />)
            ) : (
              <p className="rounded-xl border border-success/30 bg-success-tint p-4 text-sm">
                No issues found. Vibration, bearing condition and temperature are normal{pump ? " and the pump runs close to its best-efficiency point" : ""}.
              </p>
            )}
            <button type="button" onClick={() => setTab(a.kind === "pump" ? "curves" : "vibration")} className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-primary hover:underline">
              <BarChart3 className="size-4" aria-hidden /> {a.kind === "pump" ? "See where it runs on its pump curve" : "See the vibration trends"}
            </button>
          </div>
        </div>
      )}

      {tab === "vibration" && <VibrationTab asset={a} point={point} now={now} anchor={anchor} />}
      {tab === "curves" && (a.kind === "pump" ? <PumpCurvesTab asset={a} anchor={anchor} /> : <PerformanceTab asset={a} point={point} now={now} anchor={anchor} />)}
      {tab === "spectrum" && <SpectrumTab asset={a} point={point} open={open} />}
      {tab === "ai" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            {mine.length ? mine.map((o) => <ObservationCard key={o.id} obs={o} now={now} />) : <p className="rounded-xl border border-success/30 bg-success-tint p-4 text-sm">Nothing open on this machine.</p>}
          </div>
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Timeline</h3>
            <ObservationList observations={[...mine, ...history]} assets={assets} now={now} />
            {!mine.length && !history.length && <p className="text-sm text-muted-foreground">No observations in the last 30 days.</p>}
            <p className="mt-4 text-xs text-muted-foreground">
              Each diagnosis comes from the vibration features (ISO zones, fault frequencies, bearing indicators, pump hydraulics) and lists the readings it used, so an engineer can check it.
            </p>
          </section>
        </div>
      )}
    </section>
  );
}
