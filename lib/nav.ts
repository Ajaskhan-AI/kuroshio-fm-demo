import {
  Activity,
  BellRing,
  Building2,
  Calculator,
  FileText,
  LayoutGrid,
  Server,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  key: ScreenKey;
  label: string;
  /** Short label for the phone tab bar. */
  short: string;
  icon: LucideIcon;
  /** Building-scoped screens live under /buildings/[id]/... */
  scoped: boolean;
  href: (buildingId: string) => string;
}

export type ScreenKey =
  | "portfolio"
  | "smdb"
  | "bms"
  | "energy"
  | "alarms"
  | "maintenance"
  | "reports"
  | "roi";

// Order matters: presenter mode keys 1–8 follow this list (CLAUDE.md §9).
export const NAV_ITEMS: readonly NavItem[] = [
  { key: "portfolio", label: "Portfolio overview", short: "Overview", icon: LayoutGrid, scoped: false, href: () => "/" },
  { key: "smdb", label: "Live SMDB monitor", short: "Live", icon: Activity, scoped: true, href: (id) => `/buildings/${id}/smdb` },
  { key: "bms", label: "BMS cloud", short: "BMS", icon: Server, scoped: true, href: (id) => `/buildings/${id}/bms` },
  { key: "energy", label: "Energy and waste", short: "Energy", icon: Zap, scoped: true, href: (id) => `/buildings/${id}/energy` },
  { key: "alarms", label: "Alarms and work orders", short: "Alarms", icon: BellRing, scoped: false, href: () => "/alarms" },
  { key: "maintenance", label: "Predictive maintenance", short: "Maintenance", icon: Wrench, scoped: false, href: () => "/maintenance" },
  { key: "reports", label: "Carbon and reports", short: "Reports", icon: FileText, scoped: false, href: () => "/reports" },
  { key: "roi", label: "ROI and book a pilot", short: "ROI", icon: Calculator, scoped: false, href: () => "/roi" },
] as const;

/** Phone bottom bar: Overview, Live, Alarms, Energy, More (CLAUDE.md §5). */
export const MOBILE_TABS: readonly ScreenKey[] = ["portfolio", "smdb", "alarms", "energy"];

export const BuildingIcon = Building2;

/** Which screen a pathname belongs to. */
export function screenForPath(pathname: string): ScreenKey {
  if (pathname === "/") return "portfolio";
  const scoped = pathname.match(/^\/buildings\/[^/]+\/(smdb|bms|energy)/);
  if (scoped) return scoped[1] as ScreenKey;
  const top = pathname.split("/")[1];
  const hit = NAV_ITEMS.find((n) => n.key === top);
  return hit ? hit.key : "portfolio";
}

/** Building id in the URL, if the current screen is building-scoped. */
export function buildingIdForPath(pathname: string): string | undefined {
  return pathname.match(/^\/buildings\/([^/]+)/)?.[1];
}
