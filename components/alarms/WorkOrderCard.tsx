"use client";

import { AlertOctagon, AlertTriangle, CheckCircle2, Clock, Play, Square } from "lucide-react";
import { getBuilding } from "@/lib/buildings";
import { fmtCountdown, fmtDuration, fmtTime } from "@/lib/format";
import { slaMs, slaState } from "@/lib/sim/sla";
import { useSim } from "@/lib/sim/store";
import type { Technician, WorkOrder } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PriorityChip } from "@/components/cards/StatusChip";

const STEPS = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In progress" },
  { key: "closed", label: "Closed" },
] as const;

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-primary", className)}>
      {initials}
    </span>
  );
}

function SlaClock({ wo, now }: { wo: WorkOrder; now: number }) {
  const state = slaState(wo, now);
  const total = slaMs(wo);

  if (wo.respondedAt !== undefined) {
    const took = wo.respondedAt - wo.createdAt;
    const met = state === "met";
    return (
      <p className={cn("inline-flex items-center gap-1.5 text-sm font-medium", met ? "text-success" : "text-danger")}>
        {met ? <CheckCircle2 className="size-4" aria-hidden /> : <AlertOctagon className="size-4" aria-hidden />}
        Responded in {fmtDuration(took)} · {met ? "within SLA" : "SLA missed"}
      </p>
    );
  }

  const left = wo.slaDueAt - now;
  const usedPct = Math.min(100, Math.max(0, ((now - wo.createdAt) / total) * 100));
  const Icon = state === "breached" ? AlertOctagon : state === "at-risk" ? AlertTriangle : Clock;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 font-semibold tabular-nums",
            state === "breached" && "text-danger",
            state === "at-risk" && "text-foreground [&_svg]:text-warning",
          )}
        >
          <Icon className="size-4" aria-hidden />
          {state === "breached" ? `Overdue by ${fmtCountdown(left)}` : `${fmtCountdown(left)} left to respond`}
        </span>
        <span className="text-xs text-muted-foreground">SLA {fmtDuration(total)}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={cn("h-full rounded-full transition-[width] duration-1000", state === "breached" ? "bg-danger" : state === "at-risk" ? "bg-warning" : "bg-primary")}
          style={{ width: `${usedPct}%` }}
        />
      </div>
    </div>
  );
}

export function WorkOrderCard({ wo, tech, now }: { wo: WorkOrder; tech?: Technician; now: number }) {
  const setStatus = useSim((s) => s.setWorkOrderStatus);
  const building = getBuilding(wo.buildingId);
  const step = STEPS.findIndex((s) => s.key === wo.status);

  return (
    <article id={wo.id} className={cn("scroll-mt-24 rounded-xl border bg-card p-4", wo.status === "closed" ? "border-border opacity-80" : "border-border")}>
      <div className="flex flex-wrap items-center gap-2">
        <PriorityChip priority={wo.priority} short />
        <span className="font-semibold tabular-nums">{wo.id}</span>
        <span className="text-xs text-muted-foreground">
          {wo.autoCreated ? "Auto-created" : "Created"} {fmtTime(wo.createdAt)}
        </span>
      </div>
      <p className="mt-2 font-semibold">
        {wo.title}
        <span className="font-normal text-muted-foreground"> · {building?.name}</span>
      </p>

      {tech && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <Avatar name={tech.name} />
          <span>
            <span className="font-medium">{tech.name}</span>
            <span className="text-muted-foreground"> · {tech.trade}</span>
          </span>
        </div>
      )}

      {/* Open → In progress → Closed */}
      <ol className="mt-3 flex items-center gap-1 text-xs" aria-label="Work order status">
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex flex-1 items-center gap-1">
            <span
              aria-current={i === step ? "step" : undefined}
              className={cn(
                "flex-1 rounded-md px-2 py-1 text-center font-semibold",
                i < step && "bg-accent text-primary",
                i === step && "bg-primary text-primary-foreground",
                i > step && "bg-muted text-muted-foreground",
              )}
            >
              {s.label}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-3">
        <SlaClock wo={wo} now={now} />
      </div>

      {wo.status !== "closed" ? (
        <div className="mt-3 flex gap-2">
          {wo.status === "open" && (
            <button
              type="button"
              onClick={() => setStatus(wo.id, "in_progress")}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Play className="size-4" aria-hidden /> Start work
            </button>
          )}
          <button
            type="button"
            onClick={() => setStatus(wo.id, "closed")}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold hover:border-primary/50"
          >
            <Square className="size-4" aria-hidden /> Close
          </button>
        </div>
      ) : (
        wo.closedAt && <p className="mt-2 text-xs text-muted-foreground">Closed {fmtTime(wo.closedAt)}</p>
      )}
    </article>
  );
}
