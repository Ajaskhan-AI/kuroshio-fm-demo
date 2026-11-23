"use client";

import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { BUILDINGS } from "@/lib/buildings";
import { fmtDuration, fmtNum, fmtPct } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { DAY } from "@/lib/sim/generators";
import { sortAlarms } from "@/lib/sim/selectors";
import { slaState, slaStats } from "@/lib/sim/sla";
import { useSim } from "@/lib/sim/store";
import type { Alarm, AlarmSource, Priority, WorkOrder } from "@/lib/types";
import { ChipGroup } from "@/components/cards/ChipGroup";
import { KpiCard } from "@/components/cards/KpiCard";
import { StatusChip } from "@/components/cards/StatusChip";
import { AlarmFeed } from "./AlarmFeed";
import { SlaBySite, TechnicianList } from "./SlaPanel";
import { TopAlert, worstAlarm } from "./TopAlert";
import { WorkOrderCard } from "./WorkOrderCard";

type All<T> = T | "all";
const FEED_LIMIT = 40;

function Section({ title, aside, children, id }: { title: string; aside?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
      <CheckCircle2 className="size-5 text-success" aria-hidden />
      {children}
    </p>
  );
}

export function AlarmsView() {
  const ready = useSim((s) => s.ready);
  const alarms = useSim((s) => s.alarms);
  const workOrders = useSim((s) => s.workOrders);
  const technicians = useSim((s) => s.technicians);
  const now = useNow(1000);

  const [building, setBuilding] = useState<All<string>>("all");
  const [priority, setPriority] = useState<All<Priority>>("all");
  const [source, setSource] = useState<All<AlarmSource>>("all");
  const [alarmScope, setAlarmScope] = useState<"open" | "all">("open");
  const [woScope, setWoScope] = useState<"active" | "closed">("active");

  const alarmById = useMemo(() => new Map(alarms.map((a) => [a.id, a])), [alarms]);
  const open = useMemo(() => alarms.filter((a) => a.status !== "cleared"), [alarms]);

  const matches = (a: Pick<Alarm, "buildingId" | "priority"> & { source?: AlarmSource }) =>
    (building === "all" || a.buildingId === building) &&
    (priority === "all" || a.priority === priority) &&
    (source === "all" || a.source === source);

  if (!ready || now === null) return <div className="min-h-[60vh]" aria-busy="true" />;

  const feed = sortAlarms(alarms.filter((a) => (alarmScope === "open" ? a.status !== "cleared" : true)).filter(matches));
  // Newest first reads best in a feed; priority already shows on each item.
  const feedShown = (alarmScope === "open" ? feed : [...feed].sort((a, b) => b.raisedAt - a.raisedAt)).slice(0, FEED_LIMIT);

  const woSource = (w: WorkOrder): AlarmSource | undefined => (w.alarmId ? alarmById.get(w.alarmId)?.source : undefined);
  const woFiltered = workOrders.filter((w) => matches({ buildingId: w.buildingId, priority: w.priority, source: source === "all" ? undefined : woSource(w) }));
  const woActive = woFiltered
    .filter((w) => w.status !== "closed")
    .sort((a, b) => (a.respondedAt === undefined ? 0 : 1) - (b.respondedAt === undefined ? 0 : 1) || a.slaDueAt - b.slaDueAt);
  const woClosed = woFiltered.filter((w) => w.status === "closed" && (w.closedAt ?? 0) > now - DAY).sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));
  const woShown = woScope === "active" ? woActive : woClosed;

  const stats = slaStats(workOrders, now);
  const byPri = {
    P1: slaStats(workOrders.filter((w) => w.priority === "P1"), now),
    P2: slaStats(workOrders.filter((w) => w.priority === "P2"), now),
    P3: slaStats(workOrders.filter((w) => w.priority === "P3"), now),
  };
  const allActive = workOrders.filter((w) => w.status !== "closed");
  const overdue = allActive.filter((w) => slaState(w, now) === "breached").length;
  const atRisk = allActive.filter((w) => slaState(w, now) === "at-risk").length;
  const p1 = open.filter((a) => a.priority === "P1").length;
  const techById = new Map(technicians.map((t) => [t.id, t]));

  const count = (pred: (a: Alarm) => boolean) => open.filter(pred).length;

  return (
    <div className="flex flex-col gap-5">
      <TopAlert alarm={worstAlarm(open)} openCount={open.length} scope="the portfolio" />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard
          title="Open alarms"
          value={<span className={p1 ? "text-danger" : undefined}>{fmtNum(open.length)}</span>}
          sub={`${p1} critical · ${count((a) => a.status === "acknowledged")} acknowledged`}
          chip={<StatusChip status={p1 ? "alarm" : open.length ? "warning" : "online"} label={p1 ? "Act now" : open.length ? "In hand" : "Clear"} />}
          updatedAt={now}
        />
        <KpiCard
          title="Work orders open"
          value={fmtNum(allActive.length)}
          sub={overdue ? `${overdue} overdue · ${atRisk} at risk` : atRisk ? `${atRisk} at risk of missing SLA` : "All within SLA"}
          chip={<StatusChip status={overdue ? "alarm" : atRisk ? "warning" : "online"} label={overdue ? "Overdue" : atRisk ? "At risk" : "On track"} />}
          updatedAt={now}
        />
        <KpiCard
          title="SLA met, 30 days"
          value={stats.compliancePct === null ? "–" : fmtPct(stats.compliancePct, 1)}
          sub={`${fmtNum(stats.total)} work orders · target 95%`}
          chip={<StatusChip status={(stats.compliancePct ?? 100) >= 95 ? "online" : "warning"} label={(stats.compliancePct ?? 100) >= 95 ? "On target" : "Below 95%"} />}
          updatedAt={now}
        />
        <KpiCard
          title="P1 response, avg"
          value={byPri.P1.avgResponseMs === null ? "–" : fmtDuration(byPri.P1.avgResponseMs)}
          sub={`Target 30 min · P2 ${byPri.P2.avgResponseMs === null ? "–" : fmtDuration(byPri.P2.avgResponseMs)} · P3 ${byPri.P3.avgResponseMs === null ? "–" : fmtDuration(byPri.P3.avgResponseMs)}`}
          updatedAt={now}
        />
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 md:p-4">
        <ChipGroup
          label="Building"
          value={building}
          onChange={setBuilding}
          options={[
            { value: "all", label: "All buildings", count: open.length },
            ...BUILDINGS.map((b) => ({ value: b.id, label: b.short, count: count((a) => a.buildingId === b.id) })),
          ]}
        />
        <ChipGroup
          label="Priority"
          value={priority}
          onChange={setPriority}
          options={[
            { value: "all", label: "All" },
            { value: "P1", label: "P1 critical", count: count((a) => a.priority === "P1") },
            { value: "P2", label: "P2 high", count: count((a) => a.priority === "P2") },
            { value: "P3", label: "P3 normal", count: count((a) => a.priority === "P3") },
          ]}
        />
        <ChipGroup
          label="Source"
          value={source}
          onChange={setSource}
          options={[
            { value: "all", label: "All" },
            { value: "meter", label: "Meter", count: count((a) => a.source === "meter") },
            { value: "bms", label: "BMS", count: count((a) => a.source === "bms") },
            { value: "predictive", label: "Predictive", count: count((a) => a.source === "predictive") },
          ]}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section
          id="feed-heading"
          title="Alarm feed"
          aside={
            <ChipGroup
              label="Show"
              value={alarmScope}
              onChange={setAlarmScope}
              options={[
                { value: "open", label: "Open" },
                { value: "all", label: "Include cleared" },
              ]}
              className="[&>span]:hidden"
            />
          }
        >
          {feedShown.length ? (
            <AlarmFeed alarms={feedShown} now={now} />
          ) : (
            <Empty>No {alarmScope === "open" ? "open " : ""}alarms match these filters.</Empty>
          )}
          {feed.length > FEED_LIMIT && <p className="text-xs text-muted-foreground">Showing the latest {FEED_LIMIT} of {feed.length}.</p>}
        </Section>

        <Section
          id="wo-heading"
          title="Work orders"
          aside={
            <ChipGroup
              label="Show"
              value={woScope}
              onChange={setWoScope}
              options={[
                { value: "active", label: "Active", count: woActive.length },
                { value: "closed", label: "Closed, 24 h", count: woClosed.length },
              ]}
              className="[&>span]:hidden"
            />
          }
        >
          {woShown.length ? (
            <ul className="flex flex-col gap-3">
              {woShown.slice(0, FEED_LIMIT).map((w) => (
                <li key={w.id}>
                  <WorkOrderCard wo={w} tech={techById.get(w.technicianId)} now={now} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{woScope === "active" ? "No active work orders match these filters." : "No work orders closed in the last 24 hours match these filters."}</Empty>
          )}
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section id="sla-heading" title="SLA by site" aside={<span className="text-xs text-muted-foreground">last 30 days</span>}>
          <div className="rounded-xl border border-border bg-card p-4">
            <SlaBySite orders={workOrders} now={now} />
          </div>
        </Section>
        <Section id="tech-heading" title="Technicians" aside={<span className="text-xs text-muted-foreground">fictional team</span>}>
          <TechnicianList technicians={technicians} orders={workOrders} />
        </Section>
      </div>
    </div>
  );
}
