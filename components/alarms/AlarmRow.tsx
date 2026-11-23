"use client";

import Link from "next/link";
import { ArrowRight, Wrench } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { alarmHref } from "@/lib/links";
import { useSim } from "@/lib/sim/store";
import type { Alarm } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PriorityChip } from "@/components/cards/StatusChip";

const WO_STATUS = { open: "Open", in_progress: "In progress", closed: "Closed" } as const;

/** Compact alarm line: priority, plain-language title, reading, age, linked work order. */
export function AlarmRow({ alarm, showCause = true }: { alarm: Alarm; showCause?: boolean }) {
  const now = useNow(1000);
  const wo = useSim((s) => (alarm.workOrderId ? s.workOrders.find((w) => w.id === alarm.workOrderId) : undefined));
  const tech = useSim((s) => (wo ? s.technicians.find((t) => t.id === wo.technicianId) : undefined));

  return (
    <li className={cn("rounded-lg border p-3", alarm.priority === "P1" ? "border-danger/50 bg-danger/5" : "border-border")}>
      <div className="flex flex-wrap items-center gap-2">
        <PriorityChip priority={alarm.priority} short />
        <span className="font-semibold">{alarm.title}</span>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground" suppressHydrationWarning>
          {now ? timeAgo(alarm.raisedAt, now) : ""}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{alarm.detail}</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        {wo ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Wrench className="size-3.5" aria-hidden />
            {wo.id} · {WO_STATUS[wo.status]}
            {tech && ` · ${tech.name}`}
          </span>
        ) : (
          <span />
        )}
        {showCause && (
          <Link href={alarmHref(alarm)} className="inline-flex min-h-8 items-center gap-1 font-semibold text-primary hover:underline">
            View cause <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
    </li>
  );
}
