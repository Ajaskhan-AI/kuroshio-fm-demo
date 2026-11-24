"use client";

import { Sparkles } from "lucide-react";
import { getBuilding } from "@/lib/buildings";
import { ZONE_TEXT } from "@/lib/kpulse/config";
import { maxVelocity } from "@/lib/kpulse/physics";
import { assetZone, zoneStatus } from "@/lib/kpulse/selectors";
import type { Observation, RotatingAsset } from "@/lib/kpulse/types";
import { fmtNum } from "@/lib/format";
import type { HealthStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/cards/Sparkline";
import { StatusChip } from "@/components/cards/StatusChip";
import { HealthRing } from "./HealthRing";

/** One rotating machine: health, vibration zone, 24 h velocity trend and the top AI observation. */
export function AssetTile({
  asset: a,
  status,
  top,
  trend,
  onSelect,
}: {
  asset: RotatingAsset;
  status: { status: HealthStatus; label: string };
  top?: Observation;
  trend: number[];
  onSelect: () => void;
}) {
  const zone = assetZone(a);
  const v = maxVelocity(a.readings);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex min-h-48 flex-col rounded-xl border bg-card p-4 text-left shadow-xs transition-colors hover:border-primary/50",
        status.status === "alarm" ? "border-danger/60" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">
            {a.tag} <span className="font-normal text-muted-foreground">· {getBuilding(a.buildingId)?.short}</span>
          </p>
          <p className="truncate text-xs text-muted-foreground">{a.name}</p>
        </div>
        <StatusChip status={status.status} label={status.label} className="max-w-[55%] truncate" />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <HealthRing value={a.health} status={status.status} />
        <div className="min-w-0 flex-1">
          {a.tripped ? (
            <p className="text-lg font-bold text-danger">Not running</p>
          ) : (
            <p className="text-2xl font-bold tabular-nums tracking-tight">
              {fmtNum(v, 1)}
              <span className="ml-1 text-sm font-semibold text-muted-foreground">mm/s</span>
            </p>
          )}
          <StatusChip status={a.tripped ? "offline" : zoneStatus[zone]} label={a.tripped ? "No vibration" : ZONE_TEXT[zone]} className="mt-1" />
        </div>
        <Sparkline data={trend} width={84} height={34} className={status.status === "alarm" ? "text-danger" : "text-primary"} label="Vibration, last 24 hours" />
      </div>

      <p className="mt-auto flex items-start gap-1.5 border-t border-border pt-2.5 text-xs">
        {top ? (
          <>
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
            <span className="line-clamp-2">
              <span className="font-semibold">{top.title}</span>
              {top.confidence ? <span className="text-muted-foreground"> · {top.confidence} % confidence</span> : null}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">No issues found · {a.typeLabel}</span>
        )}
      </p>
    </button>
  );
}
