import { ScreenHeader, ScreenPlaceholder } from "@/components/layout/ScreenHeader";
import { buildingStaticParams, resolveBuilding } from "@/lib/building-page";

export const generateStaticParams = buildingStaticParams;

export default async function Page({ params }: PageProps<"/buildings/[id]/energy">) {
  const building = await resolveBuilding(params);
  return (
    <>
      <ScreenHeader
        title="Energy and waste"
        subtitle={`${building.name} · ${building.area}. Where the money goes, and what runs after hours.`}
      />
      <ScreenPlaceholder
        step={7}
        points={[
          "Load profile and peak demand",
          "Cost in AED",
          "After-hours waste finder",
        ]}
      />
    </>
  );
}
