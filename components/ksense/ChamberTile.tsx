"use client";

import { DoorClosed, DoorOpen, Droplets, Gauge } from "lucide-react";
import { BANDS } from "@/lib/ksense/config";
import type { Chamber } from "@/lib/ksense/types";
import { fmtNum } from "@/lib/format";
import type { HealthStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/cards/Sparkline";
import { StatusChip, statusTextClass } from "@/components/cards/StatusChip";

/** One cold room: live temperature against its band, humidity, door and room pressure. */
export function ChamberTile({
  chamber: c,
  status,
  trend,
  selected,
  onSelect,
}: {
  chamber: Chamber;
  status: { status: HealthStatus; label: string };
  trend: number[];
  selected: boolean;
  onSelect: () => void;
}) {
  const band = BANDS[c.type];
  const DoorIcon = c.doorOpen ? DoorOpen : DoorClosed;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex min-h-44 flex-col rounded-xl border bg-card p-4 text-left shadow-xs transition-colors",
        selected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50",
        status.status === "alarm" && !selected && "border-danger/60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{c.name}</p>
          <p className="truncate text-xs text-muted-foreground">{c.product}</p>
        </div>
        <StatusChip status={status.status} label={status.label} />
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <p className={cn("text-3xl font-bold tabular-nums tracking-tight", status.status === "alarm" && statusTextClass.alarm)}>
          {fmtNum(c.tempC, 1)}
          <span className="ml-0.5 text-base font-semibold text-muted-foreground">°C</span>
        </p>
        <Sparkline data={trend} width={96} height={30} className={status.status === "alarm" ? "text-danger" : "text-primary"} />
      </div>
      <p className="text-xs text-muted-foreground">
        {band.label} · {band.lowC} to {band.highC} °C
      </p>

      <dl className="mt-auto grid grid-cols-3 gap-1 border-t border-border pt-2.5 text-xs tabular-nums">
        <div className="flex items-center gap-1" title="Relative humidity">
          <Droplets className="size-3.5 text-muted-foreground" aria-hidden />
          <dt className="sr-only">Humidity</dt>
          <dd>{fmtNum(c.rhPct)}%</dd>
        </div>
        <div className={cn("flex items-center gap-1", c.doorOpen && "font-semibold text-warning")}>
          <DoorIcon className="size-3.5" aria-hidden />
          <dt className="sr-only">Door</dt>
          <dd>{c.doorOpen ? "Open" : "Shut"}</dd>
        </div>
        <div className="flex items-center gap-1" title="Room differential pressure">
          <Gauge className="size-3.5 text-muted-foreground" aria-hidden />
          <dt className="sr-only">Room pressure</dt>
          <dd>{fmtNum(Math.round(c.roomPa) || 0)} Pa</dd>
        </div>
      </dl>
    </button>
  );
}
