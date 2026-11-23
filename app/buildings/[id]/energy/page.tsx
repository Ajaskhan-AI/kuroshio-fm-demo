import { Suspense } from "react";
import { EnergyView } from "@/components/energy/EnergyView";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { buildingStaticParams, resolveBuilding } from "@/lib/building-page";

export const generateStaticParams = buildingStaticParams;

const TITLE = "Energy and waste";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const building = await resolveBuilding(params);
  return (
    <>
      <ScreenHeader title={TITLE} subtitle={`${building.name} · ${building.area}. Where the money goes, and what runs when it shouldn't.`} />
      <EnergyView buildingId={building.id} />
    </>
  );
}

// Reading the URL inside Suspense keeps navigation between buildings instant (the shell shows at once).
export default function Page({ params }: PageProps<"/buildings/[id]/energy">) {
  return (
    <Suspense fallback={<ScreenHeader title={TITLE} />}>
      <Content params={params} />
    </Suspense>
  );
}
