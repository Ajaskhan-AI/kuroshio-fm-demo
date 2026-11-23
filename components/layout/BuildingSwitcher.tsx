"use client";

import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, Building2 } from "lucide-react";
import { BUILDINGS, getBuilding } from "@/lib/buildings";
import { buildingIdForPath } from "@/lib/nav";
import { useUiStore } from "@/lib/ui-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function BuildingSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const buildingId = useUiStore((s) => s.buildingId);
  const setBuildingId = useUiStore((s) => s.setBuildingId);
  const current = getBuilding(buildingId);

  function choose(id: string) {
    setBuildingId(id);
    // On a building screen, stay on the same screen for the new building.
    const urlId = buildingIdForPath(pathname);
    if (urlId) router.push(pathname.replace(`/buildings/${urlId}`, `/buildings/${id}`));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-11 min-w-0 max-w-[9.5rem] justify-start gap-2 px-3 sm:max-w-xs">
          <Building2 className="hidden size-4 shrink-0 text-primary sm:block" aria-hidden />
          <span className="truncate font-semibold">{current?.name ?? "Select building"}</span>
          <span className="hidden truncate text-muted-foreground sm:inline">· {current?.area}</span>
          <ChevronDown className="ml-auto size-4 shrink-0 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Switch building</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {BUILDINGS.map((b) => (
          <DropdownMenuItem key={b.id} onSelect={() => choose(b.id)} className="min-h-11 gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{b.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {b.area} · {b.type}
              </span>
            </div>
            {b.id === buildingId && <Check className="ml-auto size-4 text-primary" aria-label="Selected" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
