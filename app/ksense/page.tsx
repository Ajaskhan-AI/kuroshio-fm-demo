import { Suspense } from "react";
import { KsenseView } from "@/components/ksense/KsenseView";
import { ScreenHeader } from "@/components/layout/ScreenHeader";

export default function KsensePage() {
  return (
    <>
      <ScreenHeader
        title="K-Sense cold chain"
        subtitle="Every cold room, every site, one dashboard. Temperature, humidity, doors, room pressure and refrigeration pressures, live."
      />
      {/* The selected chamber comes from ?chamber=…, which is only known in the browser. */}
      <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
        <KsenseView />
      </Suspense>
    </>
  );
}
