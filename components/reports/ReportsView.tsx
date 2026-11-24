"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, FileSpreadsheet, FileText } from "lucide-react";
import logo from "@/public/kuroshio-logo.jpg";
import { BUILDINGS, getBuilding } from "@/lib/buildings";
import { usePulse } from "@/lib/kpulse/store";
import { buildReport, reportCsv, type ReportData } from "@/lib/report";
import { useSim } from "@/lib/sim/store";
import { ChipGroup } from "@/components/cards/ChipGroup";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CarbonSection } from "./CarbonSection";
import { ReportPreview } from "./ReportPreview";

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

const fileBase = (r: ReportData) => `Kuroshio-${r.buildingId}-${new Date(r.generatedAt + 4 * 3_600_000).toISOString().slice(0, 7)}`;

export function ReportsView() {
  const ready = useSim((s) => s.ready);
  const now = useSim((s) => s.now);
  const buildingsById = useSim((s) => s.buildings);
  const [buildingId, setBuildingId] = useState<string>(BUILDINGS[0].id);
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<ReportData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logoData = useRef<string | undefined>(undefined);

  // Warm everything the PDF needs while online, so download still works if the Wi-Fi drops.
  useEffect(() => {
    import("@react-pdf/renderer").catch(() => {});
    import("./ReportPdf").catch(() => {});
    fetch(logo.src)
      .then((r) => r.blob())
      .then(
        (b) =>
          new Promise<string>((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(String(fr.result));
            fr.onerror = reject;
            fr.readAsDataURL(b);
          }),
      )
      .then((d) => (logoData.current = d))
      .catch(() => {});
  }, []);

  const buildings = useMemo(() => Object.values(buildingsById), [buildingsById]);

  if (!ready) return <div className="min-h-[60vh]" aria-busy="true" />;

  // Freeze the numbers when the preview opens so what you see is exactly what downloads.
  const preview = () => {
    setSnapshot(buildReport(useSim.getState(), buildingId, Date.now(), usePulse.getState()));
    setError(null);
    setOpen(true);
  };

  const downloadPdf = async () => {
    if (!snapshot) return;
    setBusy(true);
    setError(null);
    try {
      const [{ pdf }, { ReportPdf }] = await Promise.all([import("@react-pdf/renderer"), import("./ReportPdf")]);
      const blob = await pdf(<ReportPdf r={snapshot} logo={logoData.current} />).toBlob();
      save(blob, `${fileBase(snapshot)}.pdf`);
    } catch (e) {
      console.error(e);
      setError("The PDF could not be created on this device. The CSV export still works.");
    } finally {
      setBusy(false);
    }
  };

  const downloadCsv = (r: ReportData | null) => {
    const data = r ?? buildReport(useSim.getState(), buildingId, Date.now(), usePulse.getState());
    if (data) save(new Blob([reportCsv(data)], { type: "text/csv;charset=utf-8" }), `${fileBase(data)}.csv`);
  };

  const name = getBuilding(buildingId)?.name;

  return (
    <div className="flex flex-col gap-8">
      {/* Status first: the report is the thing an FM company hands its owner. */}
      <section aria-labelledby="report-heading" className="rounded-xl border border-primary/30 bg-accent p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="report-heading" className="flex items-center gap-2 text-lg font-semibold">
              <FileText className="size-5 text-primary" aria-hidden /> Monthly owner report
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Uptime, alarms handled, SLA, energy and cost, carbon and the top 3 recommendations, ready to send. One click, no spreadsheets.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={preview}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Eye className="size-4" aria-hidden /> Preview report
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(null)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:border-primary/50"
            >
              <FileSpreadsheet className="size-4" aria-hidden /> Export CSV
            </button>
          </div>
        </div>
        <ChipGroup
          label="Building"
          value={buildingId}
          onChange={setBuildingId}
          className="mt-4"
          options={BUILDINGS.map((b) => ({ value: b.id, label: b.short }))}
        />
      </section>

      <CarbonSection buildings={buildings} now={now} />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto bg-muted p-0 sm:max-w-3xl">
          <SheetHeader className="sticky top-0 z-10 border-b border-border bg-card">
            <SheetTitle>Report preview · {name}</SheetTitle>
            <SheetDescription>Numbers are frozen at the moment you opened the preview.</SheetDescription>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadPdf}
                disabled={busy || !snapshot}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                <Download className="size-4" aria-hidden />
                {busy ? "Creating PDF…" : "Download PDF"}
              </button>
              <button
                type="button"
                onClick={() => downloadCsv(snapshot)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:border-primary/50"
              >
                <FileSpreadsheet className="size-4" aria-hidden /> CSV
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-2 text-sm font-medium text-danger">
                {error}
              </p>
            )}
          </SheetHeader>
          <div className="p-4 md:p-6">{snapshot && <ReportPreview r={snapshot} />}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
