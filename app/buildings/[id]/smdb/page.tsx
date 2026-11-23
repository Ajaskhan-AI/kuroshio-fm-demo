import { ScreenHeader, ScreenPlaceholder } from "@/components/layout/ScreenHeader";
import { buildingStaticParams, resolveBuilding } from "@/lib/building-page";

export const generateStaticParams = buildingStaticParams;

export default async function Page({ params }: PageProps<"/buildings/[id]/smdb">) {
  const building = await resolveBuilding(params);
  return (
    <>
      <ScreenHeader
        title="Live SMDB monitor"
        subtitle={`${building.name} · ${building.area}. Every panel, live, without manual rounds.`}
      />
      <ScreenPlaceholder
        step={4}
        points={[
          "Panel selector SMDB-01 to SMDB-08",
          "Live V, A, PF, kW per feeder",
          "Panel temperature and alarms",
        ]}
      />
    </>
  );
}
