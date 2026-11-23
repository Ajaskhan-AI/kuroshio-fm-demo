import { AlarmsView } from "@/components/alarms/AlarmsView";
import { ScreenHeader } from "@/components/layout/ScreenHeader";

export default function AlarmsPage() {
  return (
    <>
      <ScreenHeader title="Alarms and work orders" subtitle="Every alarm becomes a work order with an SLA clock, assigned to the right technician." />
      <AlarmsView />
    </>
  );
}
