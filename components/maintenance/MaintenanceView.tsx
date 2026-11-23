"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertOctagon, ArrowDown, CheckCircle2 } from "lucide-react";
import { BUILDINGS, getBuilding } from "@/lib/buildings";
import { fmtNum } from "@/lib/format";
import { useSim } from "@/lib/sim/store";
import type { AssetType } from "@/lib/types";
import { ChipGroup } from "@/components/cards/ChipGroup";
import { KpiCard } from "@/components/cards/KpiCard";
import { StatusChip } from "@/components/cards/StatusChip";
import { AssetDetail } from "./AssetDetail";
import { AssetList, assetLevel } from "./AssetList";

export function MaintenanceView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const ready = useSim((s) => s.ready);
  const now = useSim((s) => s.now);
  const assetsById = useSim((s) => s.assets);
  const [building, setBuilding] = useState<string>("all");
  const [type, setType] = useState<AssetType | "all">("all");
  const detailRef = useRef<HTMLDivElement>(null);

  const all = useMemo(() => Object.values(assetsById).sort((a, b) => a.health - b.health || a.name.localeCompare(b.name)), [assetsById]);
  const list = all.filter((a) => (building === "all" || a.buildingId === building) && (type === "all" || a.type === type));

  // Selected asset from ?asset=… (alarm links land here), else the worst one.
  const requested = params.get("asset");
  const selected = all.find((a) => a.id === requested) ?? list[0] ?? all[0];

  // Below lg the detail sits above the list: bring it back into view when an asset is picked.
  const picked = useRef(false);
  useEffect(() => {
    if (picked.current && window.innerWidth < 1024) detailRef.current?.scrollIntoView({ block: "start" });
  }, [selected?.id]);

  if (!ready || !selected) return <div className="min-h-[60vh]" aria-busy="true" />;

  const select = (id: string) => {
    picked.current = true;
    router.replace(`${pathname}?asset=${encodeURIComponent(id)}`, { scroll: false });
  };
  const act = all.filter((a) => assetLevel(a.health) === "act");
  const watch = all.filter((a) => assetLevel(a.health) === "watch");
  const avg = all.reduce((s, a) => s + a.health, 0) / all.length;
  const worst = all[0];

  return (
    <div className="flex flex-col gap-5">
      {act.length ? (
        <button
          type="button"
          onClick={() => select(worst.id)}
          className="group flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-danger/40 bg-danger/8 px-4 py-3 text-left text-sm hover:border-danger"
        >
          <AlertOctagon className="size-5 shrink-0 text-danger" aria-hidden />
          <span className="font-bold">
            {worst.name} · {getBuilding(worst.buildingId)?.name}
          </span>
          <span className="text-muted-foreground">
            health {fmtNum(worst.health)}/100{worst.daysToFailure !== null ? `, about ${fmtNum(worst.daysToFailure)} days to failure` : ""}. {worst.recommendation}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 font-semibold text-primary">
            Open <ArrowDown className="size-4" aria-hidden />
          </span>
        </button>
      ) : (
        <p className="flex min-h-14 items-center gap-3 rounded-xl border border-success/30 bg-success-tint px-4 py-3 text-sm font-medium">
          <CheckCircle2 className="size-5 text-success" aria-hidden /> All monitored motors are healthy.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard title="Motors monitored" value={fmtNum(all.length)} sub={`Pumps and AHU fans in ${BUILDINGS.length} buildings`} updatedAt={now} />
        <KpiCard
          title="Act now"
          value={<span className={act.length ? "text-danger" : undefined}>{fmtNum(act.length)}</span>}
          sub="Health below 70"
          chip={<StatusChip status={act.length ? "alarm" : "online"} label={act.length ? "Plan repair" : "None"} />}
          updatedAt={now}
        />
        <KpiCard
          title="Watch"
          value={fmtNum(watch.length)}
          sub="Health 70–80, check at next PPM"
          chip={<StatusChip status={watch.length ? "warning" : "online"} label={watch.length ? "Watch" : "None"} />}
          updatedAt={now}
        />
        <KpiCard title="Average health" value={`${fmtNum(avg)}/100`} sub="Across all monitored motors" updatedAt={now} />
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 md:p-4">
        <ChipGroup
          label="Building"
          value={building}
          onChange={setBuilding}
          options={[{ value: "all", label: "All buildings" }, ...BUILDINGS.map((b) => ({ value: b.id, label: b.short }))]}
        />
        <ChipGroup
          label="Type"
          value={type}
          onChange={setType}
          options={[
            { value: "all", label: "All" },
            { value: "Chilled water pump", label: "CHW pumps" },
            { value: "Condenser pump", label: "Condenser pumps" },
            { value: "AHU fan", label: "AHU fans" },
          ]}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:pr-1">
          {list.length ? (
            <AssetList assets={list} selectedId={selected.id} onSelect={select} />
          ) : (
            <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">No assets match these filters.</p>
          )}
        </div>
        <div ref={detailRef} className="order-first scroll-mt-20 lg:order-none lg:sticky lg:top-20 lg:self-start">
          <AssetDetail asset={selected} now={now} />
        </div>
      </div>
    </div>
  );
}
