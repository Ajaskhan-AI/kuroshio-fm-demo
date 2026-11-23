import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ReportsView } from "@/components/reports/ReportsView";

export default function ReportsPage() {
  return (
    <>
      <ScreenHeader title="Carbon and reports" subtitle="Scope 2 from metered energy, and the monthly owner report in one click." />
      <ReportsView />
    </>
  );
}
