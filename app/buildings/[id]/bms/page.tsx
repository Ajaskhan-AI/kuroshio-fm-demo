import { BmsView } from "@/components/bms/BmsView";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Badge } from "@/components/ui/badge";
import { buildingStaticParams, resolveBuilding } from "@/lib/building-page";

export const generateStaticParams = buildingStaticParams;

export default async function Page({ params }: PageProps<"/buildings/[id]/bms">) {
  const building = await resolveBuilding(params);
  return (
    <>
      <ScreenHeader
        title="BMS cloud"
        subtitle={`${building.name} · ${building.area}. A read-only view of the building management system, checked against the meters.`}
        badge={
          <Badge variant="outline" className="h-7 border-primary/40 px-3 text-primary" title="Ready to connect on a 30-day pilot">
            Pilot-ready
          </Badge>
        }
      />
      <BmsView buildingId={building.id} />
    </>
  );
}
