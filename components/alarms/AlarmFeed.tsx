"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Activity, ArrowRight, Check, CheckCircle2, Gauge, Server, Wrench, type LucideIcon } from "lucide-react";
import { getBuilding } from "@/lib/buildings";
import { fmtTime, timeAgo } from "@/lib/format";
import { alarmHref } from "@/lib/links";
import { useSim } from "@/lib/sim/store";
import type { Alarm, AlarmSource } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PriorityChip } from "@/components/cards/StatusChip";

export const SOURCE: Record<AlarmSource, { label: string; icon: LucideIcon }> = {
  meter: { label: "Meter", icon: Gauge },
  bms: { label: "BMS", icon: Server },
  predictive: { label: "Predictive", icon: Activity },
};

function FeedItem({ alarm, now }: { alarm: Alarm; now: number }) {
  const acknowledge = useSim((s) => s.acknowledgeAlarm);
  const building = getBuilding(alarm.buildingId);
  const src = SOURCE[alarm.source];
  const SrcIcon = src.icon;
  const cleared = alarm.status === "cleared";

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4",
        cleared ? "border-border opacity-70" : alarm.priority === "P1" ? "border-danger/60 shadow-[inset_4px_0_0_var(--danger)]" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <PriorityChip priority={alarm.priority} />
        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          <SrcIcon className="size-3.5" aria-hidden />
          {src.label}
        </span>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {fmtTime(alarm.raisedAt)} · {timeAgo(alarm.raisedAt, now)}
        </span>
      </div>
      <p className="mt-2 font-semibold">
        {alarm.title}
        <span className="font-normal text-muted-foreground"> · {building?.name}</span>
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">{alarm.detail}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {cleared ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-success">
            <CheckCircle2 className="size-4" aria-hidden /> Cleared {alarm.clearedAt ? timeAgo(alarm.clearedAt, now) : ""}
          </span>
        ) : alarm.status === "acknowledged" ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
            <Check className="size-4" aria-hidden /> Acknowledged
          </span>
        ) : (
          <button
            type="button"
            onClick={() => acknowledge(alarm.id)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:border-primary/50"
          >
            <Check className="size-4" aria-hidden /> Acknowledge
          </button>
        )}
        {alarm.workOrderId && (
          <a href={`#${alarm.workOrderId}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground">
            <Wrench className="size-4" aria-hidden /> {alarm.workOrderId}
          </a>
        )}
        <Link href={alarmHref(alarm)} className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary hover:underline">
          View cause <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

/** New alarms slide in at the top; cleared ones fade. */
export function AlarmFeed({ alarms, now }: { alarms: Alarm[]; now: number }) {
  const reduce = useReducedMotion();
  return (
    <ul className="flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {alarms.map((a) => (
          <motion.li
            key={a.id}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, marginBottom: -12 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <FeedItem alarm={a} now={now} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
