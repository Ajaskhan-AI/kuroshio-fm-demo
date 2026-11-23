"use client";

import { Download, ShieldCheck } from "lucide-react";
import { excursionLogCsv, saveFile, timeInRangePct } from "@/lib/ksense/selectors";
import { getColdSite } from "@/lib/ksense/sites";
import type { Chamber, Excursion } from "@/lib/ksense/types";
import { fmtDate, fmtDuration, fmtNum, fmtTime } from "@/lib/format";
import { DAY } from "@/lib/sim/generators";
import { StatusChip } from "@/components/cards/StatusChip";

/** Compliance view: every temperature excursion in the last 30 days, ready to hand to a client or auditor. */
export function ExcursionLog({
  excursions,
  chambers,
  chamberCount,
  now,
  onSelect,
}: {
  excursions: Excursion[];
  chambers: Record<string, Chamber>;
  chamberCount: number;
  now: number;
  onSelect: (chamberId: string) => void;
}) {
  const recent = excursions.filter((e) => (e.endedAt ?? now) > now - 30 * DAY);
  const pct = timeInRangePct(recent, chamberCount, now);

  return (
    <section aria-labelledby="excursions-heading" className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 id="excursions-heading" className="font-semibold">
            Excursion log, last 30 days
          </h2>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-success" aria-hidden />
            Time in range <span className="font-semibold tabular-nums text-foreground">{fmtNum(pct, 2)}%</span> · {fmtNum(recent.length)} excursions · logged
            automatically, no paper rounds
          </p>
        </div>
        <button
          type="button"
          onClick={() => saveFile(excursionLogCsv(recent, chambers, now), "K-Sense-excursion-log.csv")}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold hover:border-primary/50"
        >
          <Download className="size-4" aria-hidden /> Download log (CSV)
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-2 font-medium">Chamber</th>
              <th className="px-4 py-2 font-medium">Started</th>
              <th className="px-4 py-2 font-medium">Duration</th>
              <th className="px-4 py-2 font-medium">Peak</th>
              <th className="px-4 py-2 font-medium">Cause</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {recent.map((e) => {
              const c = chambers[e.chamberId];
              const ongoing = e.endedAt === undefined;
              return (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-2">
                    <button type="button" onClick={() => onSelect(e.chamberId)} className="min-h-11 text-left hover:underline">
                      <span className="font-semibold">
                        {getColdSite(e.siteId)?.short} · {c?.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">{c?.product}</span>
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    {fmtDate(e.startedAt)}, {fmtTime(e.startedAt)}
                  </td>
                  <td className="px-4 py-2">{fmtDuration((e.endedAt ?? now) - e.startedAt)}</td>
                  <td className="px-4 py-2">
                    {fmtNum(e.peakC, 1)} °C <span className="text-xs text-muted-foreground">(limit {e.limitC} °C)</span>
                  </td>
                  <td className="px-4 py-2">{e.cause}</td>
                  <td className="px-4 py-2">
                    <StatusChip status={ongoing ? "alarm" : "online"} label={ongoing ? "Ongoing" : "Closed"} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
