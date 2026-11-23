import { Suspense } from "react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { SmdbView } from "@/components/smdb/SmdbView";
import { buildingStaticParams, resolveBuilding } from "@/lib/building-page";

export const generateStaticParams = buildingStaticParams;

const TITLE = "Live SMDB monitor";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const building = await resolveBuilding(params);
  return (
    <>
      <ScreenHeader title={TITLE} subtitle={`${building.name} · ${building.area}. Every panel, live, without manual rounds.`} />
      {/* The panel comes from ?panel=…, which is only known in the browser. */}
      <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
        <SmdbView buildingId={building.id} />
      </Suspense>
    </>
  );
}

// Reading the URL inside Suspense keeps navigation between buildings instant (the shell shows at once).
export default function Page({ params }: PageProps<"/buildings/[id]/smdb">) {
  return (
    <Suspense fallback={<ScreenHeader title={TITLE} />}>
      <Content params={params} />
    </Suspense>
  );
}
