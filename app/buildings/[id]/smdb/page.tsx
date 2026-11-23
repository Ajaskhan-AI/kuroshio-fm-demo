import { Suspense } from "react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { SmdbView } from "@/components/smdb/SmdbView";
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
      {/* The panel comes from ?panel=…, which is only known in the browser. */}
      <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
        <SmdbView buildingId={building.id} />
      </Suspense>
    </>
  );
}
