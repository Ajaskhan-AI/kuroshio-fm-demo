"use client";

import Link from "next/link";
import { ArrowRight, Check, CheckCircle2, GitCompareArrows, Wrench, X } from "lucide-react";
import { CONFIG } from "@/lib/config";
import { fmtAedEstimate, fmtKw, fmtTime } from "@/lib/format";
import { crossChecks } from "@/lib/sim/rules";
import { useSim } from "@/lib/sim/store";
import type { Alarm, BmsPoint, BuildingLive, Feeder } from "@/lib/types";
import { monthlyWasteAed } from "@/lib/energy";
import { cn } from "@/lib/utils";
import { LiveNumber } from "@/components/cards/LiveNumber";

function Finding({
  building,
  equipment,
  kind,
  kw,
  alarm,
}: {
  building: BuildingLive;
  equipment: string;
  kind: "running-while-off" | "stopped-while-on";
  kw: number;
  alarm?: Alarm;
}) {
  const createWorkOrder = useSim((s) => s.createWorkOrder);
  const wo = useSim((s) => (alarm?.workOrderId ? s.workOrders.find((w) => w.id === alarm.workOrderId) : undefined));
  const tech = useSim((s) => (wo ? s.technicians.find((t) => t.id === wo.technicianId) : undefined));
  const since = alarm ? fmtTime(alarm.raisedAt) : undefined;
  const waste = kind === "running-while-off" ? monthlyWasteAed(kw, building.rateAedPerKwh) : 0;

  return (
    <article className="rounded-xl border-2 border-warning/60 bg-card p-4 md:p-5">
      <p className="text-lg leading-snug md:text-xl">
        {kind === "running-while-off" ? (
          <>
            BMS shows <strong>{equipment} OFF</strong> (schedule) but the meter shows{" "}
            <strong className="whitespace-nowrap">
              <LiveNumber value={kw} format={fmtKw} />
            </strong>
            {since && <> since {since}</>}.
          </>
        ) : (
          <>
            BMS shows <strong>{equipment} ON</strong> but the meter shows{" "}
            <strong className="whitespace-nowrap">
              <LiveNumber value={kw} format={fmtKw} />
            </strong>
            {since && <> since {since}</>}.
          </>
        )}
      </p>
      <p className="mt-1 text-muted-foreground">
        {kind === "running-while-off"
          ? "Possible manual override or a failed relay. The BMS can't see this on its own."
          : "Possible trip, failed contactor or a stuck BMS status point. The space may not be getting air."}
      </p>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        {kind === "running-while-off" ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Estimated waste</p>
            <p className="text-2xl font-bold">
              <LiveNumber value={waste} format={(v) => `${fmtAedEstimate(v)} / month`} />
            </p>
            <p className="text-xs text-muted-foreground">
              At {CONFIG.crossCheck.wasteHoursPerDay} h a day on the demo tariff. Demo assumption.
            </p>
          </div>
        ) : (
          <div />
        )}

        {wo ? (
          <Link
            href={`/alarms#${wo.id}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-success-tint px-4 text-sm font-semibold text-success"
          >
            <Check className="size-4" aria-hidden />
            {wo.id} created{tech ? ` · ${tech.name}` : ""}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <button
            type="button"
            disabled={!alarm}
            onClick={() =>
              alarm &&
              createWorkOrder({
                buildingId: building.info.id,
                priority: "P2",
                title: kind === "running-while-off" ? `${equipment} running while BMS shows OFF` : `${equipment} stopped while BMS shows ON`,
                trade: "BMS",
                alarmId: alarm.id,
              })
            }
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Wrench className="size-4" aria-hidden />
            Create work order
          </button>
        )}
      </div>
    </article>
  );
}

/** The hero of the BMS screen: does the BMS agree with what the meters measure? */
export function CrossCheckPanel({
  building,
  points,
  feeders,
  alarms,
}: {
  building: BuildingLive;
  points: BmsPoint[];
  feeders: Feeder[];
  alarms: Alarm[];
}) {
  const checks = crossChecks(points, feeders);
  const findings = checks.filter((c) => c.mismatch);
  const alarmFor = (eq: string) => alarms.find((a) => a.status !== "cleared" && a.key === `${building.info.id}:${eq}:xcheck`);

  return (
    <section aria-labelledby="xcheck-heading" className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 id="xcheck-heading" className="flex items-center gap-2 font-semibold">
          <GitCompareArrows className="size-5 text-primary" aria-hidden />
          BMS vs meter cross-check
        </h2>
        <span className="text-xs text-muted-foreground">
          {checks.length} pieces of plant checked every {CONFIG.tickMs / 1000} s
        </span>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {findings.length ? (
          findings.map((c) => (
            <Finding key={c.equipment} building={building} equipment={c.equipment} kind={c.mismatch!} kw={c.kw} alarm={alarmFor(c.equipment)} />
          ))
        ) : (
          <p className="flex items-center gap-2 rounded-xl bg-success-tint px-4 py-3 font-medium text-foreground">
            <CheckCircle2 className="size-5 text-success" aria-hidden />
            BMS status matches metered power on all {checks.length} checks.
          </p>
        )}

        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {checks.map((c) => (
            <li
              key={c.equipment}
              className={cn("rounded-lg border p-3 text-sm", c.mismatch ? "border-warning/60 bg-warning/10" : "border-border")}
            >
              <p className="font-semibold">{c.equipment}</p>
              <dl className="mt-1 grid grid-cols-2 gap-x-2 text-xs">
                <dt className="text-muted-foreground">BMS</dt>
                <dd className="text-right font-semibold">{c.bmsOn ? "On" : "Off"}</dd>
                <dt className="text-muted-foreground">Meter</dt>
                <dd className="text-right font-semibold tabular-nums">{fmtKw(c.kw)}</dd>
              </dl>
              <p className={cn("mt-2 inline-flex items-center gap-1 text-xs font-semibold", c.mismatch ? "text-foreground" : "text-success")}>
                {c.mismatch ? <X className="size-3.5 text-warning" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
                {c.mismatch ? "Mismatch" : "Agrees"}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
