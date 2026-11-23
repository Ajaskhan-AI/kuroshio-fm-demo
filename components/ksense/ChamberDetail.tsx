"use client";

import { BatteryLow, BatteryMedium, Check, Download, Fan, Signal, Snowflake } from "lucide-react";
import { BANDS, KSENSE, UNIT_BASE } from "@/lib/ksense/config";
import { bandText, chamberLogCsv, chamberStatus, saveFile } from "@/lib/ksense/selectors";
import { getColdSite } from "@/lib/ksense/sites";
import { useCold } from "@/lib/ksense/store";
import type { Chamber, ColdAlarm } from "@/lib/ksense/types";
import { fmtKw, fmtNum, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { UpdatedAgo } from "@/components/cards/KpiCard";
import { PriorityChip, StatusChip } from "@/components/cards/StatusChip";
import { ChamberChart } from "./ChamberChart";

const fmtAedFull = (v: number) => `AED ${fmtNum(v)}`;

function Reading({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 text-xl font-bold tabular-nums", warn && "text-danger")}>{value}</dd>
      {sub && <dd className="text-xs text-muted-foreground">{sub}</dd>}
    </div>
  );
}

/** A meter bar: where a pressure sits against its normal value or limit. */
function PressureRow({ label, value, normal, limit, low }: { label: string; value: number; normal: number; limit: number; low?: boolean }) {
  const bad = low ? value < limit : value > limit;
  const max = low ? normal * 1.3 : limit * 1.15;
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className={cn("font-bold tabular-nums", bad && "text-danger")}>{fmtNum(value, 1)} bar</span>
      </div>
      <div className="relative mt-1.5 h-2 rounded-full bg-muted" aria-hidden>
        <div className={cn("h-2 rounded-full", bad ? "bg-danger" : "bg-primary")} style={{ width: `${pct}%` }} />
        <div className="absolute -top-1 h-4 w-0.5 bg-foreground/60" style={{ left: `${(limit / max) * 100}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Normal {fmtNum(normal, 1)} bar · {low ? "alarm below" : "alarm above"} {fmtNum(limit, 1)} bar
      </p>
    </div>
  );
}

export function ChamberDetail({ chamber: c, alarms, now }: { chamber: Chamber; alarms: ColdAlarm[]; now: number }) {
  const acknowledge = useCold((s) => s.acknowledge);
  const excursions = useCold((s) => s.excursions);
  const site = getColdSite(c.siteId);
  const mine = alarms.filter((a) => a.chamberId === c.id);
  const status = chamberStatus(c, alarms);
  const base = UNIT_BASE[c.type];
  const t = KSENSE.thresholds;
  const outOfRange = status.label === "Out of range" || status.label === "Too cold";
  const BatteryIcon = c.sensor.batteryPct < t.lowBatteryPct ? BatteryLow : BatteryMedium;

  return (
    <section aria-labelledby="chamber-heading" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{site?.name}</p>
          <h2 id="chamber-heading" className="text-xl font-bold">
            {c.name} · {c.product}
          </h2>
          <p className="text-sm text-muted-foreground">
            {bandText(c)} · {fmtNum(c.pallets)} pallets · {fmtAedFull(c.stockAed)} of stock
          </p>
        </div>
        <StatusChip status={status.status} label={status.label} />
      </div>

      {mine.length > 0 && (
        <ul className="flex flex-col gap-2">
          {mine.map((a) => (
            <li
              key={a.id}
              className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-sm", a.priority === "P1" ? "border-danger/50 bg-danger/8" : "border-border bg-muted/40")}
            >
              <PriorityChip priority={a.priority} short />
              <span className="font-semibold">{a.title}</span>
              {a.predictive && <span className="rounded bg-primary/10 px-1.5 text-xs font-semibold text-primary">Early warning</span>}
              <span className="w-full text-muted-foreground sm:w-auto sm:flex-1">{a.detail}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{timeAgo(a.raisedAt, now)}</span>
              {a.status === "active" ? (
                <button type="button" onClick={() => acknowledge(a.id)} className="inline-flex min-h-11 items-center rounded-md border border-border bg-card px-3 text-xs font-semibold hover:border-primary/50">
                  Acknowledge
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                  <Check className="size-3.5" aria-hidden /> Acknowledged
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Reading label="Temperature" value={`${fmtNum(c.tempC, 1)} °C`} sub={c.defrosting ? "Defrost running, alarms held" : `Setpoint ${fmtNum(BANDS[c.type].setpointC)} °C`} warn={outOfRange} />
        <Reading label="Humidity" value={`${fmtNum(c.rhPct)}%`} sub="Relative humidity" />
        <Reading
          label="Door"
          value={c.doorOpen ? "Open" : "Shut"}
          sub={c.doorOpen && c.doorOpenSince ? `for ${fmtNum((now - c.doorOpenSince) / 1000)} s` : c.doorClosedAt ? `last opened ${timeAgo(c.doorClosedAt, now)}` : "No openings yet"}
          warn={c.doorOpen && c.doorOpenSince !== undefined && now - c.doorOpenSince >= t.doorOpenAlarmS * 1000}
        />
        <Reading label="Room pressure" value={`${fmtNum(Math.round(c.roomPa) || 0)} Pa`} sub="Difference to outside" warn={!c.doorOpen && c.roomPa < t.reliefStuckPa} />
      </dl>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Temperature, last 24 hours</h3>
        <ChamberChart chamber={c} now={now} />
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
        <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Fan className="size-4 text-primary" aria-hidden /> Refrigeration unit {c.unit.name}
            </h3>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              {c.unit.running ? (
                <>Compressor running · {fmtKw(c.unit.kw)}</>
              ) : (
                <>
                  <Snowflake className="size-3.5" aria-hidden /> Off for defrost
                </>
              )}
            </span>
          </div>
          <PressureRow label="Suction pressure" value={c.unit.suctionBar} normal={base.suctionBar} limit={(base.suctionBar * t.suctionLowPct) / 100} low />
          <PressureRow label="Discharge pressure" value={c.unit.dischargeBar} normal={base.dischargeBar} limit={t.dischargeHighBar} />
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
          <h3 className="font-semibold">K-Sense sensor</h3>
          <p className={cn("flex items-center gap-2 tabular-nums", c.sensor.batteryPct < t.lowBatteryPct && "font-semibold text-danger")}>
            <BatteryIcon className="size-4" aria-hidden /> Battery {fmtNum(c.sensor.batteryPct)}%
          </p>
          <p className="flex items-center gap-2">
            <Signal className="size-4 text-muted-foreground" aria-hidden /> Signal {c.sensor.signal}
          </p>
          <UpdatedAgo at={c.sensor.lastSeenAt} className="mt-auto" />
        </div>
      </div>

      <button
        type="button"
        onClick={() => saveFile(chamberLogCsv(c, excursions, now), `K-Sense-${c.siteId}-${c.name}-temperature-log.csv`)}
        className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-lg border border-border px-4 text-sm font-semibold hover:border-primary/50"
      >
        <Download className="size-4" aria-hidden /> Download temperature log (CSV)
      </button>
    </section>
  );
}
