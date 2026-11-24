import { Suspense } from "react";
import { KpulseView } from "@/components/kpulse/KpulseView";
import { ScreenHeader } from "@/components/layout/ScreenHeader";

export default function KpulsePage() {
  return (
    <>
      <ScreenHeader
        title="K-Pulse rotating assets"
        subtitle="Vibration condition monitoring for pumps, compressors, motors and fans. Hear the problem before you see it."
      />
      {/* The selected asset and tab come from ?asset=…&tab=…, which are only known in the browser. */}
      <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
        <KpulseView />
      </Suspense>
    </>
  );
}
