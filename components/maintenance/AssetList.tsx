"use client";

import { AlertOctagon, AlertTriangle, CheckCircle2, type LucideIcon } from "lucide-react";
import { getBuilding } from "@/lib/buildings";
import { CONFIG } from "@/lib/config";
import { fmtNum } from "@/lib/format";
import type { Asset } from "@/lib/types";
import { cn } from "@/lib/utils";

export type AssetLevel = "good" | "watch" | "act";

export function assetLevel(health: number): AssetLevel {
  return health < CONFIG.thresholds.assetHealthAlarm ? "act" : health < 80 ? "watch" : "good";
}

export const LEVEL: Record<AssetLevel, { label: string; icon: LucideIcon; chip: string; bar: string }> = {
  good: { label: "Good", icon: CheckCircle2, chip: "bg-success-tint text-success", bar: "bg-success" },
  watch: { label: "Watch", icon: AlertTriangle, chip: "bg-warning/15 text-foreground [&_svg]:text-warning", bar: "bg-warning" },
  act: { label: "Act now", icon: AlertOctagon, chip: "bg-danger/12 text-danger", bar: "bg-danger" },
};

export function LevelChip({ health, className }: { health: number; className?: string }) {
  const l = LEVEL[assetLevel(health)];
  const Icon = l.icon;
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold", l.chip, className)}>
      <Icon className="size-3.5" aria-hidden />
      {l.label}
    </span>
  );
}

export function AssetList({ assets, selectedId, onSelect }: { assets: Asset[]; selectedId?: string; onSelect: (id: string) => void }) {
  return (
    <ul className="flex flex-col gap-2" aria-label="Monitored assets, worst health first">
      {assets.map((a) => {
        const level = assetLevel(a.health);
        const on = a.id === selectedId;
        return (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onSelect(a.id)}
              aria-pressed={on}
              className={cn(
                "flex w-full flex-col gap-2 rounded-xl border bg-card p-3 text-left transition-[border-color,box-shadow] hover:border-primary/50",
                on ? "border-primary ring-2 ring-primary/20" : "border-border",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{a.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {getBuilding(a.buildingId)?.name} · {a.type}
                  </p>
                </div>
                <LevelChip health={a.health} />
              </div>
              <div className="flex items-center gap-3">
                <span className="w-12 text-xl font-bold tabular-nums">{fmtNum(a.health)}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span className={cn("block h-full rounded-full", LEVEL[level].bar)} style={{ width: `${a.health}%` }} />
                </span>
                <span className="w-24 text-right text-xs text-muted-foreground">
                  {a.daysToFailure !== null ? `~${fmtNum(a.daysToFailure)} days left` : "Stable"}
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
