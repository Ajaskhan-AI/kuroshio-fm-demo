"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getBuilding } from "@/lib/buildings";
import { NAV_ITEMS, buildingIdForPath, screenForPath } from "@/lib/nav";

interface Crumb {
  label: string;
  href?: string;
}

/** Portfolio › Building › Screen › Panel. */
export function Breadcrumbs() {
  const pathname = usePathname();
  const panel = useSearchParams().get("panel");
  const screen = NAV_ITEMS.find((n) => n.key === screenForPath(pathname));
  const building = getBuilding(buildingIdForPath(pathname));

  const crumbs: Crumb[] = [{ label: "Portfolio", href: "/" }];
  if (building) crumbs.push({ label: building.name, href: `/buildings/${building.id}/smdb` });
  if (screen && screen.key !== "portfolio") crumbs.push({ label: screen.label, href: panel ? pathname : undefined });
  if (panel && screen?.key === "smdb") crumbs.push({ label: panel });
  if (crumbs.length === 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.label} className="flex items-center gap-1">
              {c.href && !last ? (
                <Link href={c.href} className="rounded hover:text-foreground hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? "font-medium text-foreground" : undefined}>
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight className="size-3.5" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
