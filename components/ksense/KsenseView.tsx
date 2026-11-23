"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertOctagon, AlertTriangle, ArrowDown, CheckCircle2 } from "lucide-react";
import { HISTORY_SLOT, chamberHistory } from "@/lib/ksense/history";
import { chamberStatus, isTempAlarm, openColdAlarms } from "@/lib/ksense/selectors";
import { COLD_SITES, getColdSite } from "@/lib/ksense/sites";
import { useCold } from "@/lib/ksense/store";
import { fmtKw, fmtNum } from "@/lib/format";
import { ChipGroup } from "@/components/cards/ChipGroup";
import { KpiCard } from "@/components/cards/KpiCard";
import { StatusChip } from "@/components/cards/StatusChip";
import { ChamberDetail } from "./ChamberDetail";
import { ChamberTile } from "./ChamberTile";
import { ExcursionLog } from "./ExcursionLog";

const fmtAedShort = (v: number) => (v >= 1_000_000 ? `AED ${fmtNum(v / 1_000_000, 2)}M` : `AED ${fmtNum(Math.round(v / 1_000))}k`);

type Show = "all" | "attention";

export function KsenseView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const ready = useCold((s) => s.ready);
  const now = useCold((s) => s.now);
  const chambers = useCold((s) => s.chambers);
  const chamberIds = useCold((s) => s.chamberIds);
  const alarms = useCold((s) => s.alarms);
  const excursions = useCold((s) => s.excursions);
  const [site, setSite] = useState<string>("all");
  const [show, setShow] = useState<Show>("all");
  const detailRef = useRef<HTMLDivElement>(null);

  const open = useMemo(() => openColdAlarms(alarms), [alarms]);

  // 6 h trend per chamber for the tiles; recomputed every 5 minutes, not every tick.
  const slot = Math.floor(now / HISTORY_SLOT);
  const trends = useMemo(() => {
    const out: Record<string, number[]> = {};
    for (const id of chamberIds) out[id] = chamberHistory(chambers[id], slot * HISTORY_SLOT, 6).map((p) => p.c);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chamberIds, slot]);

  const requested = params.get("chamber");
  const selectedId = requested && chambers[requested] ? requested : (open[0]?.chamberId ?? chamberIds[0]);
  const selected = selectedId ? chambers[selectedId] : undefined;

  const picked = useRef(false);
  useEffect(() => {
    if (picked.current && window.innerWidth < 1024) detailRef.current?.scrollIntoView({ block: "start" });
  }, [selectedId]);

  if (!ready || !selected) return <div className="min-h-[60vh]" aria-busy="true" />;

  const select = (id: string) => {
    picked.current = true;
    router.replace(`${pathname}?chamber=${encodeURIComponent(id)}`, { scroll: false });
  };

  const all = chamberIds.map((id) => chambers[id]);
  const statusOf = (id: string) => chamberStatus(chambers[id], open);
  const inRange = all.filter((c) => !open.some((a) => a.chamberId === c.id && isTempAlarm(a))).length;
  const tempAlarms = open.filter(isTempAlarm);
  const atRisk = [...new Set(tempAlarms.map((a) => a.chamberId))].reduce((sum, id) => sum + chambers[id].stockAed, 0);
  const critical = open.filter((a) => a.priority === "P1").length;
  const kw = all.reduce((sum, c) => sum + c.unit.kw, 0);
  const worst = open[0];
  const worstChamber = worst ? chambers[worst.chamberId] : undefined;

  const visible = all.filter((c) => (site === "all" || c.siteId === site) && (show === "all" || statusOf(c.id).status !== "online"));
  const sites = COLD_SITES.filter((s) => visible.some((c) => c.siteId === s.id));

  return (
    <div className="flex flex-col gap-5">
      {worst && worstChamber ? (
        <button
          type="button"
          onClick={() => select(worst.chamberId)}
          className={
            worst.priority === "P1"
              ? "flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-danger/40 bg-danger/8 px-4 py-3 text-left text-sm hover:border-danger"
              : "flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-warning/50 bg-warning/10 px-4 py-3 text-left text-sm hover:border-warning"
          }
        >
          {worst.priority === "P1" ? <AlertOctagon className="size-5 shrink-0 text-danger" aria-hidden /> : <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden />}
          <span className="font-bold">
            {worst.title} · {getColdSite(worst.siteId)?.short} {worstChamber.name} ({worstChamber.product})
          </span>
          <span className="text-muted-foreground">{worst.detail}</span>
          <span className="ml-auto inline-flex items-center gap-1 font-semibold text-primary">
            Open <ArrowDown className="size-4" aria-hidden />
          </span>
        </button>
      ) : (
        <p className="flex min-h-14 items-center gap-3 rounded-xl border border-success/30 bg-success-tint px-4 py-3 text-sm font-medium">
          <CheckCircle2 className="size-5 text-success" aria-hidden /> All {all.length} chambers in range across {COLD_SITES.length} sites.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard
          title="Chambers in range"
          value={
            <span className={inRange < all.length ? "text-danger" : undefined}>
              {fmtNum(inRange)}/{fmtNum(all.length)}
            </span>
          }
          sub={`${COLD_SITES.length} sites, one dashboard`}
          chip={<StatusChip status={inRange < all.length ? "alarm" : "online"} label={inRange < all.length ? `${all.length - inRange} out` : "All in"} />}
          updatedAt={now}
        />
        <KpiCard
          title="Open alarms"
          value={fmtNum(open.length)}
          sub={critical ? `${critical} critical` : "None critical"}
          chip={<StatusChip status={critical ? "alarm" : open.length ? "warning" : "online"} label={critical ? "Act now" : open.length ? "Check" : "Clear"} />}
          updatedAt={now}
        />
        <KpiCard
          title="Stock at risk"
          value={<span className={atRisk ? "text-danger" : undefined}>{atRisk ? fmtAedShort(atRisk) : "AED 0"}</span>}
          sub="Value in chambers out of range"
          chip={<StatusChip status={atRisk ? "alarm" : "online"} label={atRisk ? "At risk" : "Safe"} />}
          updatedAt={now}
        />
        <KpiCard title="Refrigeration now" value={fmtKw(kw)} sub={`${all.filter((c) => c.unit.running).length} of ${all.length} compressors running`} updatedAt={now} />
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 md:p-4">
        <ChipGroup
          label="Site"
          value={site}
          onChange={setSite}
          options={[
            { value: "all", label: "All sites", count: all.length },
            ...COLD_SITES.map((s) => ({ value: s.id, label: s.short, count: all.filter((c) => c.siteId === s.id).length })),
          ]}
        />
        <ChipGroup
          label="Show"
          value={show}
          onChange={setShow}
          options={[
            { value: "all", label: "All chambers" },
            { value: "attention", label: "Needs attention", count: all.filter((c) => statusOf(c.id).status !== "online").length },
          ]}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="flex flex-col gap-5">
          {sites.length ? (
            sites.map((s) => (
              <section key={s.id} aria-labelledby={`site-${s.id}`}>
                <h2 id={`site-${s.id}`} className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
                  {s.name} <span className="text-xs font-normal text-muted-foreground">{s.area}</span>
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {visible
                    .filter((c) => c.siteId === s.id)
                    .map((c) => (
                      <ChamberTile key={c.id} chamber={c} status={statusOf(c.id)} trend={trends[c.id] ?? []} selected={c.id === selectedId} onSelect={() => select(c.id)} />
                    ))}
                </div>
              </section>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">Every chamber here is in range. Nothing needs attention.</p>
          )}
        </div>
        {/* Sticky beside the tiles, but never taller than the screen: the panel scrolls on its own so its bottom is always reachable. */}
        <div
          ref={detailRef}
          className="order-first scroll-mt-20 lg:order-none lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:rounded-xl"
        >
          <ChamberDetail chamber={selected} alarms={open} now={now} />
        </div>
      </div>

      <ExcursionLog excursions={excursions} chambers={chambers} chamberCount={all.length} now={now} onSelect={select} />
    </div>
  );
}
