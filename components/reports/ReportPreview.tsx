import Image from "next/image";
import logo from "@/public/kuroshio-logo.jpg";
import { fmtAedEstimate, fmtDate, fmtKw, fmtKwh, fmtNum, fmtPct, fmtTime } from "@/lib/format";
import type { ReportData } from "@/lib/report";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[#E1E6EF] p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#45526B]">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-[#0F1A30]">{value}</p>
      {sub && <p className="text-xs text-[#45526B]">{sub}</p>}
    </div>
  );
}

/** On-screen preview of the owner report. Paper-white in both themes, like the PDF it mirrors. */
export function ReportPreview({ r }: { r: ReportData }) {
  const delta = r.energyVsLastMonthPct;
  return (
    <article className="mx-auto w-full max-w-[720px] rounded-lg bg-white p-6 text-[#0F1A30] shadow-sm ring-1 ring-[#E1E6EF] md:p-8">
      {/* Cover */}
      <header className="border-b-4 border-[#004DC3] pb-5">
        <div className="flex items-start justify-between gap-4">
          <Image src={logo} alt="Kuroshio AI" className="h-5 w-auto" />
          <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-semibold text-[#92400E]">Demo data</span>
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-[#1F54CC]">Monthly facility report</p>
        <h3 className="mt-1 text-2xl font-bold">{r.buildingName}</h3>
        <p className="text-sm text-[#45526B]">
          {r.area} · {r.type}
        </p>
        <p className="mt-2 text-sm text-[#45526B]">{r.periodLabel}</p>
      </header>

      <section className="mt-5">
        <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#45526B]">The month at a glance</h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Monitoring uptime" value={fmtPct(r.uptimePct, 2)} sub="Meter data received" />
          <Stat label="Alarms handled" value={fmtNum(r.alarmsHandled)} sub={`${r.alarmsOpen} still open`} />
          <Stat
            label="SLA met"
            value={r.slaPct === null ? "–" : fmtPct(r.slaPct, 1)}
            sub={r.p1AvgResponseMin === null ? undefined : `P1 response ${fmtNum(r.p1AvgResponseMin)} min avg`}
          />
          <Stat label="Energy" value={fmtKwh(r.energyKwh)} sub={`${delta < 0 ? "▼" : "▲"} ${fmtPct(Math.abs(delta), 1)} vs last month`} />
          <Stat label="Cost" value={fmtAedEstimate(r.costAed)} sub="Demo tariff" />
          <Stat label="Scope 2 carbon" value={`${fmtNum(r.tco2e, 1)} tCO₂e`} sub={`Factor ${r.factor} tCO₂e/MWh`} />
        </div>
        <p className="mt-2 text-xs text-[#45526B]">
          Peak demand {fmtKw(r.peakKw)} · power factor {r.pf.toFixed(2)}
        </p>
      </section>

      <section className="mt-5">
        <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#45526B]">Top 3 recommendations</h4>
        <ol className="flex flex-col gap-2">
          {r.recommendations.map((rec, i) => (
            <li key={rec.title} className="flex gap-3 rounded-lg bg-[#EAF0FC] p-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#1F54CC] text-xs font-bold text-white">{i + 1}</span>
              <div>
                <p className="font-semibold">{rec.title}</p>
                <p className="text-sm text-[#45526B]">{rec.detail}</p>
              </div>
            </li>
          ))}
          {!r.recommendations.length && <li className="text-sm text-[#45526B]">Nothing urgent this month.</li>}
        </ol>
      </section>

      <section className="mt-5">
        <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#45526B]">Notable alarms this month</h4>
        {r.incidents.length ? (
          <ul className="divide-y divide-[#E1E6EF] text-sm">
            {r.incidents.map((a) => (
              <li key={`${a.title}-${a.raisedAt}`} className="flex gap-3 py-2">
                <span className="w-8 shrink-0 font-bold">{a.priority}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{a.title}</span> <span className="text-[#45526B]">· {a.detail}</span>
                </span>
                <span className="shrink-0 text-xs text-[#45526B] tabular-nums">
                  {fmtDate(a.raisedAt)} {fmtTime(a.raisedAt)}
                  <br />
                  {a.status === "cleared" ? "Resolved" : "Open"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#45526B]">No critical or high-priority alarms this month.</p>
        )}
      </section>

      <footer className="mt-6 border-t border-[#E1E6EF] pt-3 text-[11px] text-[#45526B]">
        Prepared by Kuroshio FacilityIQ · generated {fmtDate(r.generatedAt)} {fmtTime(r.generatedAt)} GST. Demo data: tariff and emission factor are
        demo assumptions.
      </footer>
    </article>
  );
}
