"use client";

import { BUILDINGS } from "@/lib/buildings";
import { CONFIG } from "@/lib/config";
import { fmtDuration, fmtPct } from "@/lib/format";
import { slaStats } from "@/lib/sim/sla";
import type { Technician, WorkOrder } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar } from "./WorkOrderCard";

const TARGET_PCT = 95;

/** SLA compliance and average response per site, last 30 days. */
export function SlaBySite({ orders, now }: { orders: WorkOrder[]; now: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <caption className="sr-only">SLA compliance by site, last 30 days</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-medium">Site</th>
            <th scope="col" className="py-2 pr-3 font-medium">Within SLA</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">P1 response, avg</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Jobs</th>
            <th scope="col" className="py-2 text-right font-medium">Open</th>
          </tr>
        </thead>
        <tbody>
          {BUILDINGS.map((b) => {
            const s = slaStats(
              orders.filter((w) => w.buildingId === b.id),
              now,
            );
            const p1 = slaStats(
              orders.filter((w) => w.buildingId === b.id && w.priority === "P1"),
              now,
            );
            const pct = s.compliancePct ?? 100;
            const below = pct < TARGET_PCT;
            return (
              <tr key={b.id} className="border-b border-border last:border-0">
                <th scope="row" className="py-3 pr-3 text-left font-medium">
                  {b.name}
                </th>
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="relative h-2 w-24 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span className={cn("absolute inset-y-0 left-0 rounded-full", below ? "bg-warning" : "bg-success")} style={{ width: `${pct}%` }} />
                      <span className="absolute inset-y-0 w-px bg-foreground/50" style={{ left: `${TARGET_PCT}%` }} />
                    </span>
                    <span className={cn("font-semibold tabular-nums", below && "text-foreground")}>{s.compliancePct === null ? "–" : fmtPct(pct, 1)}</span>
                    {below && <span className="text-xs text-muted-foreground">below {TARGET_PCT}%</span>}
                  </div>
                </td>
                <td className="py-3 pr-3 text-right tabular-nums">{p1.avgResponseMs === null ? "–" : fmtDuration(p1.avgResponseMs)}</td>
                <td className="py-3 pr-3 text-right tabular-nums">{s.total}</td>
                <td className="py-3 text-right tabular-nums">
                  {s.open}
                  {s.overdue > 0 && <span className="ml-1 font-semibold text-danger">({s.overdue} overdue)</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted-foreground">
        SLA = time for a technician to pick up the job: P1 {fmtDuration(CONFIG.slaMinutes.P1 * 60_000)}, P2{" "}
        {fmtDuration(CONFIG.slaMinutes.P2 * 60_000)}, P3 {fmtDuration(CONFIG.slaMinutes.P3 * 60_000)}. Target {TARGET_PCT}%.
      </p>
    </div>
  );
}

export function TechnicianList({ technicians, orders }: { technicians: Technician[]; orders: WorkOrder[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {technicians.map((t) => {
        const active = orders.filter((w) => w.technicianId === t.id && w.status !== "closed");
        const busy = active.some((w) => w.status === "in_progress");
        return (
          <li key={t.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
            <Avatar name={t.name} className="size-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.trade}</p>
            </div>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", busy ? "bg-accent text-primary" : "bg-muted text-muted-foreground")}>
              {active.length ? `${active.length} job${active.length > 1 ? "s" : ""}` : "Available"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
