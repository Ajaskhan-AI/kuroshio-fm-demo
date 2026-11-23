"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertOctagon, AlertTriangle, CheckCircle2, ClipboardCheck, WifiOff, X } from "lucide-react";
import { CONFIG } from "@/lib/config";
import { fmtNum } from "@/lib/format";
import { openAlarms, panelStatus, sortAlarms } from "@/lib/sim/selectors";
import { useSim } from "@/lib/sim/store";
import type { HealthStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AlarmRow } from "@/components/alarms/AlarmRow";
import { TopAlert, worstAlarm } from "@/components/alarms/TopAlert";
import { UpdatedAgo } from "@/components/cards/KpiCard";
import { LiveNumber } from "@/components/cards/LiveNumber";
import { StatusChip } from "@/components/cards/StatusChip";
import { FeederHistoryChart } from "./FeederHistoryChart";
import { PanelDiagram } from "./PanelDiagram";
import { TempGauge } from "./TempGauge";

const CHIP_ICON: Record<HealthStatus, typeof CheckCircle2> = {
  online: CheckCircle2,
  warning: AlertTriangle,
  alarm: AlertOctagon,
  offline: WifiOff,
};

function Card({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-border bg-card", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        {aside}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function SmdbView({ buildingId }: { buildingId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const ready = useSim((s) => s.ready);
  const now = useSim((s) => s.now);
  const building = useSim((s) => s.buildings[buildingId]);
  const panelIds = useSim((s) => s.panelIds[buildingId]);
  const panels = useSim((s) => s.panels);
  const alarms = useSim((s) => s.alarms);

  const open = useMemo(() => openAlarms(alarms).filter((a) => a.buildingId === buildingId), [alarms, buildingId]);
  const list = useMemo(() => (panelIds ?? []).map((id) => panels[id]), [panelIds, panels]);

  // Panel from the URL (?panel=SMDB-04), so alarm links land on the right panel.
  const requested = params.get("panel");
  const panel = list.find((p) => p.name === requested) ?? list[0];

  // On phones the chip row scrolls: keep the selected panel's chip in view (e.g. after an alarm link).
  const activeChip = useRef<HTMLButtonElement>(null);
  const activeName = panel?.name;
  useEffect(() => {
    // Scroll only the chip row. scrollIntoView would also nudge outer scrollers, which on phones
    // widened the layout viewport (the page rendered zoomed out).
    const chip = activeChip.current;
    const row = chip?.closest("nav");
    if (chip && row) row.scrollLeft = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
  }, [activeName, ready]);

  const [feederPick, setFeederPick] = useState<{ panelId: string; feederId: string } | null>(null);
  const selectedFeederId =
    feederPick && panel && feederPick.panelId === panel.id ? feederPick.feederId : panel?.feeders[0]?.id;
  const feeder = panel?.feeders.find((f) => f.id === selectedFeederId) ?? panel?.feeders[0];

  if (!ready || !building || !panel || !feeder) return <div className="min-h-[60vh]" aria-busy="true" />;

  const selectPanel = (name: string) => router.replace(`${pathname}?panel=${name}`, { scroll: false });
  const panelOpen = sortAlarms(open.filter((a) => a.target.panelId === panel.id));
  const pStatus = panelStatus(panel, open);
  const statusLabel = panel.status === "tripped" ? "Tripped" : panel.status === "offline" ? "Offline" : "Online";
  const hoursSaved = (building.manualReadingsAvoided * CONFIG.minutesPerManualReading) / 60;

  return (
    <div className="flex flex-col gap-5">
      <TopAlert alarm={worstAlarm(open)} openCount={open.length} scope={building.info.name} />

      {/* Panel selector: chips, not a dropdown (CLAUDE.md §5). */}
      <nav aria-label="Panels" className="no-scrollbar relative -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex w-max gap-2 md:w-auto md:flex-wrap">
          {list.map((p) => {
            const st = panelStatus(p, open);
            const Icon = p.status === "tripped" ? X : CHIP_ICON[st];
            const on = p.id === panel.id;
            return (
              <li key={p.id}>
                <button
                  ref={on ? activeChip : undefined}
                  type="button"
                  onClick={() => selectPanel(p.name)}
                  aria-pressed={on}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4",
                      !on && st === "online" && "text-success",
                      !on && st === "warning" && "text-warning",
                      !on && st === "alarm" && "text-danger",
                      !on && st === "offline" && "text-offline",
                    )}
                    aria-hidden
                  />
                  {p.name}
                  <span className="sr-only">, {st === "online" ? "normal" : st}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card
          title={`${panel.name} · ${panel.location}`}
          aside={
            <div className="flex items-center gap-3">
              <UpdatedAgo at={panel.updatedAt} />
              <StatusChip status={pStatus === "alarm" || pStatus === "offline" ? pStatus : "online"} label={statusLabel} />
            </div>
          }
        >
          <PanelDiagram
            panel={panel}
            open={open}
            selectedFeederId={feeder.id}
            onSelectFeeder={(id) => setFeederPick({ panelId: panel.id, feederId: id })}
          />
        </Card>

        <div className="grid content-start gap-5 md:grid-cols-2 xl:grid-cols-1">
          <Card title="Panel temperature" aside={<UpdatedAgo at={panel.updatedAt} />}>
            <TempGauge tempC={panel.tempC} offline={panel.status === "offline"} />
          </Card>

          <Card title={`Alarms on ${panel.name}`} aside={<span className="text-xs text-muted-foreground tabular-nums">{panelOpen.length} open</span>}>
            {panelOpen.length ? (
              <ul className="flex flex-col gap-2">
                {panelOpen.map((a) => (
                  <AlarmRow key={a.id} alarm={a} showCause={false} />
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-success" aria-hidden />
                No open alarms on this panel.
              </p>
            )}
          </Card>

          <Card title="Manual readings avoided" aside={<span className="text-xs text-muted-foreground">this month</span>} className="md:col-span-2 xl:col-span-1">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="size-8 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="text-3xl font-bold">
                  <LiveNumber value={building.manualReadingsAvoided} format={(v) => fmtNum(v)} />
                </p>
                <p className="text-sm text-muted-foreground">
                  ≈ {fmtNum(hoursSaved)} technician hours not spent walking to panels
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {list.length} panels × {CONFIG.manualRoundsPerPanelPerDay} rounds a day × {CONFIG.minutesPerManualReading} min each. Demo assumption.
            </p>
          </Card>
        </div>
      </div>

      <Card
        title={`Last 24 hours · ${feeder.name}`}
        aside={<span className="text-xs text-muted-foreground">Tap a feeder above to switch</span>}
      >
        <ul className="mb-4 flex flex-wrap gap-2" aria-label="Feeders">
          {panel.feeders.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => setFeederPick({ panelId: panel.id, feederId: f.id })}
                aria-pressed={f.id === feeder.id}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-sm font-medium",
                  f.id === feeder.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50",
                )}
              >
                {f.name}
              </button>
            </li>
          ))}
        </ul>
        <FeederHistoryChart building={building} panel={panel} feeder={feeder} now={now} />
        <p className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-sm bg-primary" aria-hidden /> Load (kW)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-chart-2" aria-hidden /> Current, average of phases (A)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0 w-4 border-t-2 border-dashed border-danger" aria-hidden /> Breaker rating
          </span>
        </p>
      </Card>
    </div>
  );
}
