import { ScreenHeader, ScreenPlaceholder } from "@/components/layout/ScreenHeader";

export default function Page() {
  return (
    <>
      <ScreenHeader title="Alarms and work orders" subtitle="Every alarm becomes a work order with an SLA clock." />
      <ScreenPlaceholder
        step={5}
        points={[
    "Global feed: meter, BMS and predictive alarms",
    "Auto work orders, P1/P2/P3 SLA timers",
    "SLA compliance per site",
        ]}
      />
    </>
  );
}
