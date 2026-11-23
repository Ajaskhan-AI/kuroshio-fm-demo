"use client";

import Link from "next/link";
import { ArrowRight, Bell } from "lucide-react";
import { fmtKw, fmtNum } from "@/lib/format";
import { alarmHref, buildingHref } from "@/lib/links";
import type { Alarm, BuildingLive } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LiveNumber } from "@/components/cards/LiveNumber";
import { Sparkline } from "@/components/cards/Sparkline";
import { StatusChip } from "@/components/cards/StatusChip";

export function BuildingCard({
  b,
  topAlarm,
  trend,
  highlighted,
  onHover,
}: {
  b: BuildingLive;
  topAlarm?: Alarm;
  trend: number[];
  highlighted: boolean;
  onHover: (id: string | null) => void;
}) {
  return (
    <li
      className={cn(
        "relative rounded-xl border bg-card p-4 transition-[border-color,box-shadow]",
        highlighted ? "border-primary shadow-md ring-2 ring-primary/25" : "border-border hover:border-primary/40",
      )}
      onMouseEnter={() => onHover(b.info.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Stretched link: the whole card opens the building. */}
          <Link
            href={buildingHref(b.info.id)}
            className="font-semibold text-foreground after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
            onFocus={() => onHover(b.info.id)}
            onBlur={() => onHover(null)}
          >
            {b.info.name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {b.info.area} · {b.info.type}
          </p>
        </div>
        <StatusChip status={b.status} />
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-1">
          <span className={cn("text-3xl font-bold tabular-nums", b.status === "alarm" ? "text-danger" : "text-foreground")}>
            {fmtNum(b.health)}
          </span>
          <span className="text-sm text-muted-foreground">/100 health</span>
        </div>
        <Sparkline data={trend} width={96} height={30} label={`${b.info.name} load, last 24 hours`} />
      </div>

      <dl className="mt-2 flex items-center gap-4 text-sm">
        <div className="flex items-baseline gap-1.5">
          <dt className="sr-only">Live load</dt>
          <dd className="font-semibold">
            <LiveNumber value={b.kw} format={fmtKw} />
          </dd>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Bell className="size-3.5" aria-hidden />
          <dt className="sr-only">Open alarms</dt>
          <dd className="tabular-nums">
            {b.openAlarms} open {b.openAlarms === 1 ? "alarm" : "alarms"}
          </dd>
        </div>
      </dl>

      {topAlarm && (
        // Sits above the stretched link: "anything red goes to its cause".
        <Link
          href={alarmHref(topAlarm)}
          className={cn(
            "relative z-10 mt-3 flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm",
            topAlarm.priority === "P1" ? "bg-danger/10 text-danger" : "bg-muted text-foreground",
          )}
        >
          <span className="font-semibold">{topAlarm.priority}</span>
          <span className="min-w-0 flex-1 truncate">{topAlarm.title}</span>
          <ArrowRight className="size-4 shrink-0" aria-hidden />
        </Link>
      )}
    </li>
  );
}
