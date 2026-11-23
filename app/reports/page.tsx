import { ScreenHeader, ScreenPlaceholder } from "@/components/layout/ScreenHeader";

export default function Page() {
  return (
    <>
      <ScreenHeader title="Carbon and monthly report" subtitle="Scope 2 emissions and a one-click owner report." />
      <ScreenPlaceholder
        step={9}
        points={[
    "Scope 2 tCO₂e from metered kWh",
    "Monthly owner report PDF with preview",
    "CSV export",
        ]}
      />
    </>
  );
}
