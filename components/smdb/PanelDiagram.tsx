"use client";

import { AlertOctagon, AlertTriangle, CheckCircle2, X, Zap } from "lucide-react";
import { CONFIG } from "@/lib/config";
import { fmtA, fmtKw, fmtKwh, fmtNum, fmtPf, fmtTime, fmtV } from "@/lib/format";
import { avg3, feederAlarm } from "@/lib/sim/selectors";
import type { Alarm, Feeder, Panel, Triple } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LiveNumber } from "@/components/cards/LiveNumber";

const PHASES = ["L1", "L2", "L3"] as const;

function PhaseBars({ i, ratedA, dim }: { i: Triple; ratedA?: number; dim?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      {PHASES.map((ph, k) => {
        const pct = ratedA ? (i[k] / ratedA) * 100 : 0;
        return (
          <div key={ph} className="grid grid-cols-[1.5rem_1fr_3.75rem] items-center gap-2 text-xs">
            <span className="font-medium text-muted-foreground">{ph}</span>
            {ratedA ? (
              <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                <span
                  className={cn(
                    "block h-full rounded-full transition-[width] duration-700",
                    dim ? "bg-offline" : pct > 100 ? "bg-danger" : pct > 85 ? "bg-warning" : "bg-primary",
                  )}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </span>
            ) : (
              <span />
            )}
            <span className="text-right font-semibold tabular-nums">{fmtA(i[k])}</span>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/** Feeder state in words + icon, from its worst open alarm. */
function feederState(f: Feeder, alarm: Alarm | undefined) {
  if (f.tripped) return { label: "Tripped", icon: X, cls: "bg-danger text-white" };
  if (!alarm) return { label: "Normal", icon: CheckCircle2, cls: "bg-success-tint text-success" };
  const label =
    alarm.type === "overload" ? "Overloaded" : alarm.type === "low-pf" ? "Low PF" : alarm.type === "phase-imbalance" ? "Imbalance" : alarm.type === "bms-mismatch" ? "BMS mismatch" : alarm.title;
  return alarm.priority === "P1"
    ? { label, icon: AlertOctagon, cls: "bg-danger/12 text-danger" }
    : { label, icon: AlertTriangle, cls: "bg-warning/15 text-foreground [&_svg]:text-warning" };
}

function FeederCard({
  f,
  alarm,
  selected,
  offline,
  onSelect,
}: {
  f: Feeder;
  alarm?: Alarm;
  selected: boolean;
  offline: boolean;
  onSelect: () => void;
}) {
  const st = feederState(f, alarm);
  const Icon = st.icon;
  return (
    // Each grid row gets its own busbar segment (border-top), so multi-row layouts still read as one board.
    <li className="relative pl-5 md:border-t-4 md:border-primary/60 md:px-1.5 md:pt-7">
      {/* Drop from the busbar: vertical on desktop, horizontal stub off the rail on phones. */}
      <span aria-hidden className="absolute left-0 top-7 h-0.5 w-5 bg-border md:left-1/2 md:top-0 md:h-7 md:w-0.5 md:-translate-x-1/2" />
      <span
        aria-hidden
        title={f.tripped ? "Breaker open" : "Breaker closed"}
        className={cn(
          "absolute left-1.5 top-[1.3rem] z-[1] grid size-4 place-items-center rounded-[3px] border-2 md:left-1/2 md:top-1.5 md:-translate-x-1/2",
          f.tripped ? "border-danger bg-danger text-white" : "border-primary bg-card",
        )}
      >
        {f.tripped && <X className="size-3" strokeWidth={3} />}
      </span>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "flex w-full flex-col gap-3 rounded-xl border bg-card p-3 text-left transition-[border-color,box-shadow] hover:border-primary/50",
          selected ? "border-primary ring-2 ring-primary/20" : "border-border",
          (f.tripped || alarm?.priority === "P1") && !selected && "border-danger/60",
          offline && "opacity-60",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold">{f.name}</p>
            <p className="text-xs text-muted-foreground">Breaker {f.ratedA} A</p>
          </div>
          <span className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold", st.cls)}>
            <Icon className="size-3.5" aria-hidden />
            {st.label}
          </span>
        </div>
        <div className="text-2xl font-bold">
          <LiveNumber value={f.kw} format={fmtKw} />
        </div>
        <PhaseBars i={f.i} ratedA={f.ratedA} dim={offline} />
        <dl className="grid grid-cols-3 gap-2 border-t border-border pt-2 text-sm">
          <Stat label="Voltage" value={fmtV(avg3(f.v))} />
          <Stat label="PF" value={<span className={f.kw > 1 && f.pf < CONFIG.thresholds.lowPf ? "text-danger" : undefined}>{fmtPf(f.pf)}</span>} />
          <Stat label="Today" value={fmtKwh(f.kwhToday)} />
        </dl>
      </button>
    </li>
  );
}

export function PanelDiagram({
  panel,
  open,
  selectedFeederId,
  onSelectFeeder,
}: {
  panel: Panel;
  open: Alarm[];
  selectedFeederId: string | undefined;
  onSelectFeeder: (id: string) => void;
}) {
  const offline = panel.status === "offline";
  const inc = panel.incomer;
  const cols = panel.feeders.length >= 4 ? "md:grid-cols-2 2xl:grid-cols-4" : "md:grid-cols-2 2xl:grid-cols-3";

  return (
    <div className="flex flex-col">
      {offline && (
        <p className="mb-3 rounded-lg bg-offline/15 px-3 py-2 text-sm text-foreground">
          No data from this panel&apos;s meter since {fmtTime(panel.updatedAt)}. Showing the last readings.
        </p>
      )}

      {/* Incomer */}
      <div className={cn("relative mx-auto w-full max-w-2xl rounded-xl border-2 border-primary/50 bg-accent/40 p-4", offline && "opacity-60")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-semibold">
            <Zap className="size-4 text-primary" aria-hidden />
            Incomer · {CONFIG.electrical.voltageLL} V, 3-phase, {CONFIG.electrical.frequencyHz} Hz
          </p>
          <span className="text-2xl font-bold">
            <LiveNumber value={inc.kw} format={fmtKw} />
          </span>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Voltage L-N</p>
              <dl className="flex flex-col gap-1 text-xs">
                {PHASES.map((ph, k) => (
                  <div key={ph} className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{ph}</dt>
                    <dd className="font-semibold tabular-nums">{fmtNum(inc.v[k], 1)} V</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Current</p>
              <PhaseBars i={inc.i} />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-1 sm:border-l sm:border-border sm:pl-4">
            <Stat label="Power factor" value={fmtPf(inc.pf)} />
            <Stat label="Energy today" value={<LiveNumber value={inc.kwhToday} format={fmtKwh} />} />
          </dl>
        </div>
      </div>

      {/* Busbar */}
      <div className="relative mt-0 pl-0 md:mt-0">
        <span aria-hidden className="mx-auto block h-6 w-0.5 bg-border md:h-6" />
        <ul
          className={cn(
            "relative grid grid-cols-1 gap-3 border-l-4 border-primary/60 md:gap-x-0 md:gap-y-5 md:border-l-0",
            cols,
          )}
          aria-label={`Outgoing feeders on ${panel.name}`}
        >
          {panel.feeders.map((f) => (
            <FeederCard
              key={f.id}
              f={f}
              alarm={feederAlarm(f, open)}
              selected={f.id === selectedFeederId}
              offline={offline}
              onSelect={() => onSelectFeeder(f.id)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
