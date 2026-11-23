"use client";

import Link from "next/link";
import { ArrowRight, Check, Lightbulb, Plug, Wrench } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getBuilding } from "@/lib/buildings";
import { CONFIG } from "@/lib/config";
import { fmtDate, fmtNum } from "@/lib/format";
import { DAY, dubaiDayStart } from "@/lib/sim/generators";
import { useSim } from "@/lib/sim/store";
import type { Asset } from "@/lib/types";
import { cn } from "@/lib/utils";
import { assetLevel, LevelChip } from "./AssetList";

const WO_STATUS = { open: "Open", in_progress: "In progress", closed: "Closed" } as const;

function TrendChart({ asset, now }: { asset: Asset; now: number }) {
  const today = dubaiDayStart(now);
  const data = asset.healthHistory.map((h, i) => ({
    day: today - (asset.healthHistory.length - 1 - i) * DAY,
    health: h,
    signature: asset.signatureHistory[i],
  }));
  const maxSig = Math.max(4, ...asset.signatureHistory);
  return (
    <div className="h-64 w-full" role="img" aria-label={`${asset.name}: health and motor current signature indicator over 30 days`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="kfm-sig" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="day" tickFormatter={(t: number) => fmtDate(t)} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} stroke="var(--border)" minTickGap={20} />
          <YAxis yAxisId="h" domain={[0, 100]} ticks={[0, 25, 50, 70, 80, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} stroke="var(--border)" width={44} />
          <YAxis yAxisId="s" orientation="right" domain={[0, Math.ceil(maxSig)]} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} stroke="var(--border)" width={32} />
          <ReferenceLine yAxisId="h" y={CONFIG.thresholds.assetHealthAlarm} stroke="var(--danger)" strokeDasharray="5 4" label={{ value: "Act below 70", position: "insideBottomLeft", fill: "var(--danger)", fontSize: 11 }} />
          <Tooltip
            labelFormatter={(t) => fmtDate(Number(t))}
            formatter={(v, name) => [name === "Health" ? `${fmtNum(Number(v))} / 100` : fmtNum(Number(v), 2), name]}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)", fontSize: 13 }}
            labelStyle={{ color: "var(--muted-foreground)" }}
          />
          <Area yAxisId="s" dataKey="signature" name="Current signature indicator" type="monotone" stroke="var(--chart-2)" strokeWidth={1.5} fill="url(#kfm-sig)" isAnimationActive={false} />
          <Line yAxisId="h" dataKey="health" name="Health" type="monotone" stroke="var(--primary)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AssetDetail({ asset, now }: { asset: Asset; now: number }) {
  const createWorkOrder = useSim((s) => s.createWorkOrder);
  // An open work order for this asset: from its predictive alarm, or one raised here.
  const wo = useSim((s) => {
    const alarm = s.alarms.find((a) => a.status !== "cleared" && a.target.assetId === asset.id && a.workOrderId);
    const id = alarm?.workOrderId;
    return (
      (id ? s.workOrders.find((w) => w.id === id && w.status !== "closed") : undefined) ??
      s.workOrders.find((w) => w.status !== "closed" && w.buildingId === asset.buildingId && w.title.startsWith(`${asset.name}:`))
    );
  });
  const tech = useSim((s) => (wo ? s.technicians.find((t) => t.id === wo.technicianId) : undefined));
  const level = assetLevel(asset.health);
  const first = asset.healthHistory[0];
  const change = asset.health - first;
  const building = getBuilding(asset.buildingId);

  return (
    <section aria-labelledby="asset-heading" className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 md:px-5">
        <div>
          <h2 id="asset-heading" className="text-lg font-semibold">
            {asset.name} <span className="font-normal text-muted-foreground">· {building?.name}</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            {asset.type} · {asset.location}
          </p>
        </div>
        <LevelChip health={asset.health} />
      </div>

      <div className="flex flex-col gap-5 p-4 md:p-5">
        <dl className="grid grid-cols-3 gap-3">
          <div>
            <dt className="text-xs text-muted-foreground">Health</dt>
            <dd className={cn("text-3xl font-bold tabular-nums", level === "act" && "text-danger")}>
              {fmtNum(asset.health)}
              <span className="text-base font-medium text-muted-foreground">/100</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">30-day change</dt>
            <dd className="text-3xl font-bold tabular-nums">
              {change > 0 ? "+" : ""}
              {fmtNum(change)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Est. days to failure</dt>
            <dd className="text-3xl font-bold tabular-nums">{asset.daysToFailure !== null ? `~${fmtNum(asset.daysToFailure)}` : "–"}</dd>
          </div>
        </dl>

        <div className={cn("flex items-start gap-3 rounded-lg p-3", level === "good" ? "bg-muted" : "bg-accent")}>
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">Recommendation</p>
            <p className="font-semibold">{asset.recommendation}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {wo ? (
            <Link href={`/alarms#${wo.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-success-tint px-4 text-sm font-semibold text-success">
              <Check className="size-4" aria-hidden />
              {wo.id} · {WO_STATUS[wo.status]}
              {tech ? ` · ${tech.name}` : ""}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() =>
                createWorkOrder({
                  buildingId: asset.buildingId,
                  priority: level === "act" ? "P2" : "P3",
                  title: `${asset.name}: ${asset.recommendation.replace(/\.$/, "")}`,
                  trade: "Mechanical",
                })
              }
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Wrench className="size-4" aria-hidden />
              Create work order
            </button>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Last 30 days</h3>
          <TrendChart asset={asset} now={now} />
          <p className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-primary" aria-hidden /> Health score (left)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-sm bg-chart-2" aria-hidden /> Motor current signature indicator (right, higher = more wear)
            </span>
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
          <Plug className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">How it&apos;s measured: </span>
            clip-on CT clamps on the motor&apos;s feeder in the panel. Motor current signature analysis (MCSA) picks up patterns linked to bearing
            wear, misalignment and imbalance. Non-invasive: no sensors on the motor and no shutdown to install.
          </p>
        </div>
      </div>
    </section>
  );
}
