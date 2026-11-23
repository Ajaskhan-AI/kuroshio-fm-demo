import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { PilotForm } from "@/components/roi/PilotForm";
import { ComingNext, SiteQr } from "@/components/roi/QrAndRoadmap";
import { RoiCalculator } from "@/components/roi/RoiCalculator";

export default function RoiPage() {
  return (
    <>
      <ScreenHeader title="ROI and book a pilot" subtitle="Move the sliders to your portfolio. The answer updates as you go." />
      <div className="flex flex-col gap-8">
        <RoiCalculator />

        <section aria-labelledby="pilot-heading" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="rounded-xl border border-border bg-card p-4 md:p-5">
            <h2 id="pilot-heading" className="text-lg font-semibold">
              Book a 30-day pilot
            </h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              We meter a few of your SMDBs for 30 days and show you the numbers from your own buildings.
            </p>
            <PilotForm />
          </div>
          <SiteQr />
        </section>

        <ComingNext />
      </div>
    </>
  );
}
