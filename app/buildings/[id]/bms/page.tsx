import { Suspense } from "react";
import { BmsView } from "@/components/bms/BmsView";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Badge } from "@/components/ui/badge";
import { buildingStaticParams, resolveBuilding } from "@/lib/building-page";

export const generateStaticParams = buildingStaticParams;

const TITLE = "BMS cloud";
const PILOT = (
  <Badge variant="outline" className="h-7 border-primary/40 px-3 text-primary" title="Ready to connect on a 30-day pilot">
    Pilot-ready
  </Badge>
);

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const building = await resolveBuilding(params);
  return (
    <>
      <ScreenHeader
        title={TITLE}
        subtitle={`${building.name} · ${building.area}. A read-only view of the building management system, checked against the meters.`}
        badge={PILOT}
      />
      <BmsView buildingId={building.id} />
    </>
  );
}

// Reading the URL inside Suspense keeps navigation between buildings instant (the shell shows at once).
export default function Page({ params }: PageProps<"/buildings/[id]/bms">) {
  return (
    <Suspense fallback={<ScreenHeader title={TITLE} badge={PILOT} />}>
      <Content params={params} />
    </Suspense>
  );
}
