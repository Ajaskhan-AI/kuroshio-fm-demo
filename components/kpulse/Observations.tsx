"use client";

import Link from "next/link";
import { Check, CheckCircle2, ClipboardList, Lightbulb, Sparkles, TriangleAlert } from "lucide-react";
import { getBuilding } from "@/lib/buildings";
import { usePulse } from "@/lib/kpulse/store";
import type { Observation, RotatingAsset } from "@/lib/kpulse/types";
import { fmtDate, fmtDuration, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PriorityChip } from "@/components/cards/StatusChip";

/** The full AI observation: plain summary for managers, evidence for engineers, one next step. */
export function ObservationCard({ obs: o, now, asset }: { obs: Observation; now: number; asset?: RotatingAsset }) {
  const acknowledge = usePulse((s) => s.acknowledge);
  const createWorkOrder = usePulse((s) => s.createWorkOrder);
  return (
    <article className={cn("flex flex-col gap-3 rounded-xl border p-4", o.priority === "P3" ? "border-border bg-card" : "border-danger/40 bg-danger/5")}>
      <div className="flex flex-wrap items-center gap-2">
        <PriorityChip priority={o.priority} short />
        <h3 className="text-base font-bold">{o.title}</h3>
        {asset && <span className="text-sm text-muted-foreground">· {asset.tag}</span>}
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          <Sparkles className="size-3.5" aria-hidden /> AI · {o.confidence} % confidence
        </span>
      </div>
      <p className="text-sm">{o.summary}</p>

      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence</h4>
        <ul className="flex flex-col gap-1 text-sm">
          {o.evidence.map((e) => (
            <li key={e} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              <span className="tabular-nums">{e}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <p className="flex gap-2 rounded-lg bg-muted/60 p-3 text-sm">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="font-semibold">Do next: </span>
            {o.action}
          </span>
        </p>
        <p className="flex gap-2 rounded-lg bg-muted/60 p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            <span className="font-semibold">At stake: </span>
            {o.impact}
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {o.workOrderId ? (
          <Link href="/alarms" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-success/40 bg-success-tint px-3 text-sm font-semibold text-success">
            <ClipboardList className="size-4" aria-hidden /> Work order {o.workOrderId}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => createWorkOrder(o.id)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <ClipboardList className="size-4" aria-hidden /> Create work order
          </button>
        )}
        {o.status === "active" ? (
          <button type="button" onClick={() => acknowledge(o.id)} className="inline-flex min-h-11 items-center rounded-lg border border-border bg-card px-3 text-sm font-semibold hover:border-primary/50">
            Acknowledge
          </button>
        ) : (
          o.status === "acknowledged" && (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground">
              <Check className="size-4" aria-hidden /> Acknowledged
            </span>
          )
        )}
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">First seen {o.raisedAt < now - 86_400_000 ? fmtDate(o.raisedAt) : timeAgo(o.raisedAt, now)}</span>
      </div>
    </article>
  );
}

/** Compact rows (fleet panel) or a timeline (asset tab), open first, then closed. */
export function ObservationList({
  observations,
  assets,
  now,
  compact,
  onSelect,
}: {
  observations: Observation[];
  assets: Record<string, RotatingAsset>;
  now: number;
  compact?: boolean;
  onSelect?: (assetId: string) => void;
}) {
  return (
    <ol className={cn("flex flex-col", compact ? "gap-2" : "gap-0")}>
      {observations.map((o) => {
        const a = assets[o.assetId];
        const closed = o.status === "cleared";
        const body = (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {closed ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <PriorityChip priority={o.priority} short />}
              <span className="font-semibold">{o.title}</span>
              {compact && a && (
                <span className="text-muted-foreground">
                  · {getBuilding(a.buildingId)?.short} {a.tag}
                </span>
              )}
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">{timeAgo(o.raisedAt, now)}</span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {closed && o.clearedAt
                ? `${o.resolution ?? "Cleared."} Closed after ${fmtDuration(o.clearedAt - o.raisedAt)}${o.workOrderId ? ` · ${o.workOrderId}` : ""}.`
                : `${o.confidence} % confidence · ${o.action}`}
            </p>
          </>
        );
        return (
          <li key={o.id} className={cn(!compact && "relative border-l-2 border-border pb-4 pl-4 last:pb-0", !compact && !closed && "border-primary/50")}>
            {!compact && <span className={cn("absolute -left-[5px] top-1.5 size-2 rounded-full", closed ? "bg-success" : "bg-primary")} aria-hidden />}
            {onSelect ? (
              <button type="button" onClick={() => onSelect(o.assetId)} className="w-full rounded-lg border border-border p-3 text-left text-sm hover:border-primary/50">
                {body}
              </button>
            ) : (
              <div className="text-sm">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
