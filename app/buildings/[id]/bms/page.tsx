import { ScreenHeader, ScreenPlaceholder } from "@/components/layout/ScreenHeader";
import { Badge } from "@/components/ui/badge";
import { buildingStaticParams, resolveBuilding } from "@/lib/building-page";

export const generateStaticParams = buildingStaticParams;

export default async function Page({ params }: PageProps<"/buildings/[id]/bms">) {
  const building = await resolveBuilding(params);
  return (
    <>
      <ScreenHeader
        title="BMS cloud"
        subtitle={`${building.name} · ${building.area}. Read-only view of the building management system.`}
        badge={<Badge variant="outline" className="h-7 border-primary/40 px-3 text-primary">Pilot-ready</Badge>}
      />
      <ScreenPlaceholder
        step={6}
        points={[
          "BACnet/IP connection card",
          "Live points table",
          "BMS vs meter cross-check",
        ]}
      />
    </>
  );
}
