"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { MOBILE_TABS, NAV_ITEMS, screenForPath } from "@/lib/nav";
import { useUiStore } from "@/lib/ui-store";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ThemeToggle } from "./ThemeToggle";

/** Phone navigation: Overview, Live, Alarms, Energy, More. */
export function MobileTabBar() {
  const pathname = usePathname();
  const active = screenForPath(pathname);
  const buildingId = useUiStore((s) => s.buildingId);
  const [moreOpen, setMoreOpen] = useState(false);

  const tabs = MOBILE_TABS.map((k) => NAV_ITEMS.find((n) => n.key === k)!);
  const moreItems = NAV_ITEMS.filter((n) => !MOBILE_TABS.includes(n.key));
  const moreActive = moreItems.some((n) => n.key === active);

  const tabClass = (on: boolean) =>
    cn(
      "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
      on ? "text-primary" : "text-muted-foreground",
    );

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const on = t.key === active;
          return (
            <Link key={t.key} href={t.href(buildingId)} aria-current={on ? "page" : undefined} className={tabClass(on)}>
              <Icon className="size-5" aria-hidden />
              {t.short}
            </Link>
          );
        })}
        <button type="button" onClick={() => setMoreOpen(true)} className={tabClass(moreActive)}>
          <MoreHorizontal className="size-5" aria-hidden />
          More
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <ul className="flex flex-col gap-1 px-4">
            {moreItems.map((n) => {
              const Icon = n.icon;
              const on = n.key === active;
              return (
                <li key={n.key}>
                  <Link
                    href={n.href(buildingId)}
                    onClick={() => setMoreOpen(false)}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium",
                      on ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                    {n.label}
                  </Link>
                </li>
              );
            })}
            <li className="mt-2 flex min-h-12 items-center justify-between border-t border-border px-3 pt-2 text-sm">
              Dark mode
              <ThemeToggle />
            </li>
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
