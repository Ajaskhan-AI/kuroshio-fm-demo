import { Suspense } from "react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { MaintenanceView } from "@/components/maintenance/MaintenanceView";

export default function MaintenancePage() {
  return (
    <>
      <ScreenHeader
        title="Predictive maintenance"
        subtitle="Pumps and AHU fans, watched through their motor current. Catch wear weeks before a breakdown."
      />
      {/* The selected asset comes from ?asset=…, which is only known in the browser. */}
      <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
        <MaintenanceView />
      </Suspense>
    </>
  );
}
