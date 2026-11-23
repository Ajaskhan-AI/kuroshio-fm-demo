"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAV_ITEMS, screenForPath } from "@/lib/nav";
import { useUiStore } from "@/lib/ui-store";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Logo, LogoMark } from "./Logo";

/** Desktop / tablet navigation. Hidden on phones, where MobileTabBar takes over. */
export function Sidebar() {
  const pathname = usePathname();
  const active = screenForPath(pathname);
  const buildingId = useUiStore((s) => s.buildingId);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 md:flex",
        collapsed ? "w-[76px]" : "w-72",
      )}
    >
      <div className={cn("flex h-16 items-center border-b border-border", collapsed ? "justify-center" : "px-5")}>
        <Link href="/" aria-label="Kuroshio AI home">
          {collapsed ? <LogoMark /> : <Logo />}
        </Link>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item, i) => {
            const isActive = item.key === active;
            const Icon = item.icon;
            const link = (
              <Link
                href={item.href(buildingId)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  collapsed && "justify-center px-0",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
                {!collapsed && (
                  <kbd className={cn("ml-auto text-[11px] tabular-nums opacity-50", isActive && "opacity-70")}>{i + 1}</kbd>
                )}
              </Link>
            );
            return (
              <li key={item.key}>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  link
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
