"use client";

import { useMemo } from "react";
import { crossChecks } from "@/lib/sim/rules";
import { openAlarms } from "@/lib/sim/selectors";
import { useSim } from "@/lib/sim/store";
import { TopAlert, worstAlarm } from "@/components/alarms/TopAlert";
import { ChwTrendChart } from "./ChwTrendChart";
import { ArchitectureStrip, ConnectionCard } from "./ConnectionCard";
import { CrossCheckPanel } from "./CrossCheckPanel";
import { PointsTable } from "./PointsTable";

export function BmsView({ buildingId }: { buildingId: string }) {
  const ready = useSim((s) => s.ready);
  const now = useSim((s) => s.now);
  const building = useSim((s) => s.buildings[buildingId]);
  const points = useSim((s) => s.bmsPoints[buildingId]);
  const panelIds = useSim((s) => s.panelIds[buildingId]);
  const panels = useSim((s) => s.panels);
  const alarms = useSim((s) => s.alarms);

  const feeders = useMemo(() => (panelIds ?? []).flatMap((id) => panels[id].feeders), [panelIds, panels]);
  const open = useMemo(() => openAlarms(alarms).filter((a) => a.buildingId === buildingId), [alarms, buildingId]);

  const mismatched = useMemo(
    () => new Set(points ? crossChecks(points, feeders).filter((c) => c.mismatch).map((c) => c.equipment) : []),
    [points, feeders],
  );

  if (!ready || !building || !points) return <div className="min-h-[60vh]" aria-busy="true" />;

  return (
    <div className="flex flex-col gap-5">
      <TopAlert alarm={worstAlarm(open)} openCount={open.length} scope={building.info.name} />

      <CrossCheckPanel building={building} points={points} feeders={feeders} alarms={alarms} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ConnectionCard conn={building.bms} />
        <ChwTrendChart building={building} points={points} now={now} />
      </div>

      <ArchitectureStrip />

      <PointsTable points={points} lastSyncAt={building.bms.lastSyncAt} mismatched={mismatched} />
    </div>
  );
}
