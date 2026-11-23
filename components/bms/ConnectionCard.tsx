"use client";

import { ArrowRight, ArrowUpRight, Cloud, Cpu, Lock, MapPin, MonitorSmartphone, RadioTower, Server, Wifi } from "lucide-react";
import { fmtNum, timeAgo } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import type { BmsConnection } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatusChip } from "@/components/cards/StatusChip";

const BADGES = [
  { label: "Read-only", icon: Lock },
  { label: "Outbound-only", icon: ArrowUpRight },
  { label: "UAE-hosted", icon: MapPin },
];

export function ConnectionCard({ conn }: { conn: BmsConnection }) {
  const now = useNow(1000);
  return (
    <section aria-labelledby="conn-heading" className="flex flex-col rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 id="conn-heading" className="flex items-center gap-2 font-semibold">
          <Wifi className="size-5 text-primary" aria-hidden />
          BMS connection
        </h2>
        <StatusChip status={conn.status === "online" ? "online" : "offline"} label={conn.status === "online" ? "Online" : "Offline"} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-muted-foreground">Protocol</dt>
          <dd className="text-lg font-semibold">{conn.protocol}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Last sync</dt>
          <dd className="text-lg font-semibold tabular-nums" suppressHydrationWarning>
            {now ? timeAgo(conn.lastSyncAt, now) : "–"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Devices discovered</dt>
          <dd className="text-2xl font-bold tabular-nums">{fmtNum(conn.devicesDiscovered)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Points mapped</dt>
          <dd className="text-2xl font-bold tabular-nums">{fmtNum(conn.pointsMapped)}</dd>
        </div>
      </dl>

      <ul className="mt-auto flex flex-wrap gap-2 pt-4">
        {BADGES.map(({ label, icon: Icon }) => (
          <li key={label} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary/30 bg-accent px-3 text-xs font-semibold text-primary">
            <Icon className="size-3.5" aria-hidden />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}

const FLOW = [
  { label: "Building BMS", sub: "BACnet/IP", icon: Server },
  { label: "Kuroshio edge gateway", sub: "On site, read-only", icon: Cpu },
  { label: "MQTT", sub: "Cellular or VPN, outbound only", icon: RadioTower },
  { label: "Kuroshio cloud", sub: "Azure UAE North", icon: Cloud },
  { label: "This dashboard", sub: "Any browser", icon: MonitorSmartphone },
];

/** How data gets here, in one line. No inbound ports are opened on the building network. */
export function ArchitectureStrip({ className }: { className?: string }) {
  return (
    <section aria-labelledby="arch-heading" className={cn("rounded-xl border border-border bg-card p-4 md:p-5", className)}>
      <h2 id="arch-heading" className="font-semibold">
        How it connects
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Nothing is written back to the BMS, and no inbound ports are opened on site.</p>
      <ol className="mt-4 flex flex-col gap-2 md:flex-row md:items-stretch md:gap-0">
        {FLOW.map(({ label, sub, icon: Icon }, i) => (
          <li key={label} className="flex min-w-0 flex-col items-stretch md:flex-1 md:flex-row md:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3 self-stretch rounded-lg border border-border bg-background p-3 md:flex-col md:justify-center md:text-center">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">{label}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
            </div>
            {i < FLOW.length - 1 && (
              <ArrowRight
                className="mx-auto my-0.5 size-4 shrink-0 rotate-90 text-muted-foreground md:mx-1 md:my-0 md:rotate-0"
                aria-hidden
              />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
