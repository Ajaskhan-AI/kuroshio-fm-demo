"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertOctagon, AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { BUILDINGS, getBuilding } from "@/lib/buildings";
import { KIND_LABEL, KIND_ORDER } from "@/lib/kpulse/assets";
import { RANGES, trend } from "@/lib/kpulse/history";
import { worstPoint } from "@/lib/kpulse/physics";
import { assetStatus, assetZone, fleetEnergyLost, openObservations } from "@/lib/kpulse/selectors";
import { usePulse } from "@/lib/kpulse/store";
import type { IsoZone, MachineKind } from "@/lib/kpulse/types";
import { fmtAedEstimate, fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChipGroup } from "@/components/cards/ChipGroup";
import { KpiCard } from "@/components/cards/KpiCard";
import { StatusChip } from "@/components/cards/StatusChip";
import { AssetDetail } from "./AssetDetail";
import { AssetTile } from "./AssetTile";
import { ObservationList } from "./Observations";

type Show = "all" | "attention";
const ZONES: IsoZone[] = ["A", "B", "C", "D"];
const ZONE_BAR: Record<IsoZone, string> = { A: "bg-success", B: "bg-success/50", C: "bg-warning", D: "bg-danger" };

export function KpulseView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const ready = usePulse((s) => s.ready);
  const now = usePulse((s) => s.now);
  const anchor = usePulse((s) => s.anchor);
  const assets = usePulse((s) => s.assets);
  const assetIds = usePulse((s) => s.assetIds);
  const observations = usePulse((s) => s.observations);
  const [building, setBuilding] = useState<string>("all");
  const [kind, setKind] = useState<"all" | MachineKind>("all");
  const [show, setShow] = useState<Show>("all");

  const open = useMemo(() => openObservations(observations), [observations]);

  // 24 h vibration per asset for the tiles; history recomputed every 5 minutes, live tail every tick.
  const slot = Math.floor(now / RANGES["24h"].step);
  const history = useMemo(() => {
    const out: Record<string, { t: number; v: number }[]> = {};
    for (const id of assetIds) {
      const a = assets[id];
      const pt = worstPoint(a.readings);
      // 15-minute means of the 5-minute history.
      const raw = trend(a, pt, slot * RANGES["24h"].step, "24h", anchor);
      out[id] = [];
      for (let i = 0; i + 3 <= raw.length; i += 3) {
        const c = raw.slice(i, i + 3);
        out[id].push({ t: c[0].t, v: c.reduce((s, p) => s + Math.max(p.vx, p.vy, p.vz), 0) / 3 });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetIds, slot, anchor]);

  const requested = params.get("asset");
  const selected = requested ? assets[requested] : undefined;

  if (!ready) return <div className="min-h-[60vh]" aria-busy="true" />;

  if (selected) {
    return (
      <div className="flex flex-col gap-4">
        <Link href={pathname} scroll={false} className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> All rotating assets
        </Link>
        <AssetDetail key={selected.id} asset={selected} />
      </div>
    );
  }

  const select = (id: string) => router.push(`${pathname}?asset=${encodeURIComponent(id)}`, { scroll: true });

  const all = assetIds.map((id) => assets[id]);
  const statusOf = (id: string) => assetStatus(assets[id], open);
  const trendOf = (id: string) => {
    const a = assets[id];
    const pt = worstPoint(a.readings);
    const live = a.recent[pt].map((p) => ({ t: p.t, v: Math.max(p.vx, p.vy, p.vz) }));
    const first = live[0]?.t ?? Number.POSITIVE_INFINITY;
    // Half-hour averages so the tile shows the trend, not the sensor jitter; the live tail stays at full rate.
    const past = (history[id] ?? []).filter((p) => p.t < first);
    const smooth: number[] = [];
    for (let i = 0; i < past.length; i += 2) {
      const chunk = past.slice(i, i + 2);
      smooth.push(chunk.reduce((s, p) => s + p.v, 0) / chunk.length);
    }
    const tail: number[] = [];
    for (let i = 0; i < live.length; i += 5) {
      const chunk = live.slice(i, i + 5);
      tail.push(chunk.reduce((s, p) => s + p.v, 0) / chunk.length);
    }
    return [...smooth, ...tail];
  };
  const zoneCounts = ZONES.map((z) => all.filter((a) => !a.tripped && assetZone(a) === z).length);
  const stopped = all.filter((a) => a.tripped).length;
  const critical = open.filter((o) => o.priority !== "P3").length;
  const lost = fleetEnergyLost(all);
  const avgHealth = all.reduce((s, a) => s + a.health, 0) / all.length;
  const worst = open[0];
  const worstAsset = worst ? assets[worst.assetId] : undefined;

  const visible = all.filter(
    (a) => (building === "all" || a.buildingId === building) && (kind === "all" || a.kind === kind) && (show === "all" || statusOf(a.id).status !== "online"),
  );

  return (
    <div className="flex flex-col gap-5">
      {worst && worstAsset ? (
        <button
          type="button"
          onClick={() => select(worst.assetId)}
          className={cn(
            "flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-3 text-left text-sm",
            worst.priority === "P3" ? "border-warning/50 bg-warning/10 hover:border-warning" : "border-danger/40 bg-danger/8 hover:border-danger",
          )}
        >
          {worst.priority === "P3" ? <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden /> : <AlertOctagon className="size-5 shrink-0 text-danger" aria-hidden />}
          <span className="font-bold">
            {worst.title} · {getBuilding(worstAsset.buildingId)?.short} {worstAsset.tag}
          </span>
          <span className="text-muted-foreground">{worst.summary}</span>
          <span className="ml-auto inline-flex items-center gap-1 font-semibold text-primary">
            Open <ArrowRight className="size-4" aria-hidden />
          </span>
        </button>
      ) : (
        <p className="flex min-h-14 items-center gap-3 rounded-xl border border-success/30 bg-success-tint px-4 py-3 text-sm font-medium">
          <CheckCircle2 className="size-5 text-success" aria-hidden /> All {all.length} machines healthy.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard
          title="Machines monitored"
          value={fmtNum(all.length)}
          sub={`${fmtNum(all.length * 4)} vibration sensors · ${BUILDINGS.length} buildings`}
          chip={<StatusChip status={avgHealth >= 80 ? "online" : "warning"} label={`Avg health ${fmtNum(avgHealth)}`} />}
          updatedAt={now}
        />
        <KpiCard
          title="Vibration zones (ISO 10816)"
          value={
            <span className="flex items-baseline gap-3 text-xl sm:text-2xl">
              {ZONES.map((z, i) => (
                <span key={z} className={cn(z === "C" && zoneCounts[i] && "text-warning", z === "D" && zoneCounts[i] && "text-danger")}>
                  {z}
                  <span className="ml-0.5 tabular-nums">{zoneCounts[i]}</span>
                </span>
              ))}
            </span>
          }
          sub={
            <span className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              {ZONES.map((z, i) => (
                <span key={z} className={ZONE_BAR[z]} style={{ width: `${(zoneCounts[i] / all.length) * 100}%` }} />
              ))}
            </span>
          }
          chip={stopped ? <StatusChip status="alarm" label={`${stopped} stopped`} /> : undefined}
          updatedAt={now}
        />
        <KpiCard
          title="AI observations"
          value={fmtNum(open.length)}
          sub={critical ? `${critical} high priority` : "None high priority"}
          chip={<StatusChip status={open.some((o) => o.priority === "P1") ? "alarm" : critical ? "warning" : "online"} label={critical ? "Act" : open.length ? "Plan" : "Clear"} />}
          updatedAt={now}
        />
        <KpiCard
          title="Energy lost"
          value={<span className={lost > 0 ? "text-warning" : undefined}>{fmtAedEstimate(lost)}</span>}
          sub="Per month, machines off their best point"
          updatedAt={now}
        />
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 md:p-4">
        <ChipGroup
          label="Building"
          value={building}
          onChange={setBuilding}
          options={[{ value: "all", label: "All buildings", count: all.length }, ...BUILDINGS.map((b) => ({ value: b.id, label: b.short, count: all.filter((a) => a.buildingId === b.id).length }))]}
        />
        <ChipGroup
          label="Type"
          value={kind}
          onChange={setKind}
          options={[{ value: "all", label: "All types" }, ...KIND_ORDER.map((k) => ({ value: k, label: KIND_LABEL[k], count: all.filter((a) => a.kind === k).length }))]}
        />
        <ChipGroup
          label="Show"
          value={show}
          onChange={setShow}
          options={[
            { value: "all", label: "All machines" },
            { value: "attention", label: "Needs attention", count: all.filter((a) => statusOf(a.id).status !== "online").length },
          ]}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5">
          {KIND_ORDER.filter((k) => visible.some((a) => a.kind === k)).map((k) => (
            <section key={k} aria-labelledby={`kind-${k}`}>
              <h2 id={`kind-${k}`} className="mb-2 text-sm font-semibold">
                {KIND_LABEL[k]} <span className="font-normal text-muted-foreground">· {visible.filter((a) => a.kind === k).length}</span>
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {visible
                  .filter((a) => a.kind === k)
                  .map((a) => (
                    <AssetTile key={a.id} asset={a} status={statusOf(a.id)} top={open.find((o) => o.assetId === a.id)} trend={trendOf(a.id)} onSelect={() => select(a.id)} />
                  ))}
              </div>
            </section>
          ))}
          {!visible.length && <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">Nothing here needs attention.</p>}
        </div>
        <section aria-labelledby="fleet-obs" className="flex flex-col gap-3 self-start rounded-xl border border-border bg-card p-4 xl:sticky xl:top-20">
          <h2 id="fleet-obs" className="text-sm font-semibold">
            Latest AI observations
          </h2>
          <ObservationList observations={open.slice(0, 6)} assets={assets} now={now} compact onSelect={select} />
          {!open.length && <p className="text-sm text-muted-foreground">Nothing open.</p>}
          <p className="text-xs text-muted-foreground">
            Zones follow the ISO 10816-3 velocity limits for each machine&apos;s size class. Sensors report every few minutes; spectra are captured on demand.
          </p>
        </section>
      </div>
    </div>
  );
}
