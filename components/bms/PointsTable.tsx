"use client";

import { useState } from "react";
import { AlertTriangle, Lock } from "lucide-react";
import { CONFIG } from "@/lib/config";
import { fmtNum } from "@/lib/format";
import type { BmsPoint, BmsSystem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChipGroup } from "@/components/cards/ChipGroup";
import { UpdatedAgo } from "@/components/cards/KpiCard";

const SYSTEMS: BmsSystem[] = ["AHU", "Chiller", "FCU", "Pump", "Zone"];
const SYSTEM_LABEL: Record<BmsSystem, string> = { AHU: "AHUs", Chiller: "Chillers", FCU: "FCUs", Pump: "Pumps", Zone: "Zones" };

/** Plain-language flag for a point outside its normal range; undefined when fine. */
function flag(p: BmsPoint, mismatched: Set<string>): string | undefined {
  if (p.kind === "status" && mismatched.has(p.equipment)) return "Meter disagrees";
  if (p.name === "Filter ΔP" && p.value > CONFIG.thresholds.filterDpHighPa) return "Filter dirty";
  if (p.system === "Zone" && p.setpoint !== undefined && p.value > p.setpoint + CONFIG.thresholds.zoneOverSetpointC) return "Too warm";
  return undefined;
}

function Value({ p }: { p: BmsPoint }) {
  if (p.kind === "status") {
    const on = p.value === 1;
    return (
      <span
        className={cn(
          "inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs font-semibold",
          on ? "bg-success-tint text-success" : "bg-muted text-muted-foreground",
        )}
      >
        <span className={cn("size-2 rounded-full", on ? "bg-success" : "bg-offline")} aria-hidden />
        {on ? "On" : "Off"}
      </span>
    );
  }
  return (
    <span className="font-semibold tabular-nums">
      {fmtNum(p.value, p.unit === "Pa" ? 0 : 1)} {p.unit}
    </span>
  );
}

export function PointsTable({ points, lastSyncAt, mismatched }: { points: BmsPoint[]; lastSyncAt: number; mismatched: Set<string> }) {
  const [system, setSystem] = useState<BmsSystem | "all">("all");
  const rows = system === "all" ? points : points.filter((p) => p.system === system);

  return (
    <section aria-labelledby="points-heading" className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 id="points-heading" className="font-semibold">
          Live BMS points
        </h2>
        <span className="inline-flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3.5" aria-hidden /> Read-only
          </span>
          <UpdatedAgo at={lastSyncAt} />
        </span>
      </div>
      <div className="p-4">
        <ChipGroup
          label="System"
          value={system}
          onChange={setSystem}
          className="mb-3 [&>span]:hidden"
          options={[
            { value: "all", label: "All", count: points.length },
            ...SYSTEMS.map((s) => ({ value: s, label: SYSTEM_LABEL[s], count: points.filter((p) => p.system === s).length })),
          ]}
        />
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[540px] text-sm">
            <caption className="sr-only">BMS points, live values</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">Equipment</th>
                <th scope="col" className="py-2 pr-3 font-medium">Point</th>
                <th scope="col" className="py-2 pr-3 font-medium">Value</th>
                <th scope="col" className="py-2 pr-3 font-medium">Setpoint</th>
                <th scope="col" className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const f = flag(p, mismatched);
                return (
                  <tr key={p.id} className={cn("border-b border-border last:border-0", f && "bg-warning/10")}>
                    <th scope="row" className="py-2.5 pr-3 text-left font-medium">
                      {p.equipment}
                    </th>
                    <td className="py-2.5 pr-3 text-muted-foreground">{p.name}</td>
                    <td className="py-2.5 pr-3">
                      <Value p={p} />
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">
                      {p.setpoint !== undefined ? `${fmtNum(p.setpoint, 1)} ${p.unit}` : "–"}
                    </td>
                    <td className="py-2.5">
                      {f ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold">
                          <AlertTriangle className="size-3.5 text-warning" aria-hidden /> {f}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Normal</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Showing {rows.length} key points of the full mapped list. Kuroshio reads the BMS; it never writes setpoints or switches equipment.
        </p>
      </div>
    </section>
  );
}
