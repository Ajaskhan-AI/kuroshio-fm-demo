import { notFound } from "next/navigation";
import { BUILDINGS, getBuilding, type BuildingInfo } from "./buildings";

/** Pre-render every building screen at build time so nothing waits on a server during the demo. */
export function buildingStaticParams() {
  return BUILDINGS.map((b) => ({ id: b.id }));
}

export async function resolveBuilding(params: Promise<{ id: string }>): Promise<BuildingInfo> {
  const { id } = await params;
  const building = getBuilding(id);
  if (!building) notFound();
  return building;
}
