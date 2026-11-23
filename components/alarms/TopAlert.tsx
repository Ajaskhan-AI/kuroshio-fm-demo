"use client";

import Link from "next/link";
import { AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { getBuilding } from "@/lib/buildings";
import { timeAgo } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { alarmHref } from "@/lib/links";
import type { Alarm } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PriorityChip } from "@/components/cards/StatusChip";

const RANK = { P1: 0, P2: 1, P3: 2 } as const;

/** Worst open alarm first, newest first within a priority. */
export function worstAlarm(alarms: Alarm[]): Alarm | undefined {
  let best: Alarm | undefined;
  for (const a of alarms) {
    if (a.status === "cleared") continue;
    if (!best || RANK[a.priority] < RANK[best.priority] || (a.priority === best.priority && a.raisedAt > best.raisedAt)) best = a;
  }
  return best;
}

/** "Status first": the single most important alert, linking to its cause (CLAUDE.md §5). */
export function TopAlert({ alarm, openCount, scope }: { alarm: Alarm | undefined; openCount: number; scope: string }) {
  const now = useNow(1000);

  if (!alarm) {
    return (
      <div className="flex min-h-14 items-center gap-3 rounded-xl border border-success/30 bg-success-tint px-4 py-3 text-sm font-medium text-foreground">
        <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
        No open alarms across {scope}. Everything is running normally.
      </div>
    );
  }

  const critical = alarm.priority === "P1";
  const Icon = critical ? AlertOctagon : AlertTriangle;
  const building = getBuilding(alarm.buildingId);
  const others = openCount - 1;

  return (
    <Link
      href={alarmHref(alarm)}
      className={cn(
        "group flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-3 text-sm transition-colors",
        critical
          ? "border-danger-strong bg-danger-strong text-white hover:bg-danger-strong/90"
          : "border-warning/50 bg-warning/10 text-foreground hover:border-warning",
      )}
    >
      <Icon className={cn("size-5 shrink-0", critical ? "text-white" : "text-warning")} aria-hidden />
      <PriorityChip priority={alarm.priority} short className={critical ? "bg-white text-danger-strong" : undefined} />
      <span className="font-bold">{alarm.title}</span>
      <span className={cn("min-w-0 flex-1 truncate", critical ? "text-white" : "text-muted-foreground")}>
        {building?.name} · {alarm.detail}
      </span>
      <span className={cn("hidden whitespace-nowrap tabular-nums sm:inline", critical ? "text-white" : "text-muted-foreground")} suppressHydrationWarning>
        {now ? timeAgo(alarm.raisedAt, now) : ""}
        {others > 0 && ` · +${others} more open`}
      </span>
      <span className="inline-flex items-center gap-1 whitespace-nowrap font-semibold">
        View cause <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}
