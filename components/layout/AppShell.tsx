"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { buildingIdForPath } from "@/lib/nav";
import { getBuilding } from "@/lib/buildings";
import { useUiStore } from "@/lib/ui-store";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SimRunner } from "@/components/sim/SimRunner";
import { AlarmToaster } from "@/components/alarms/AlarmToaster";
import { Kiosk } from "@/components/presenter/Kiosk";
import { Presenter } from "@/components/presenter/Presenter";
import { selectOpenAlarmCount, useSim } from "@/lib/sim/store";
import { Breadcrumbs } from "./Breadcrumbs";
import { MobileTabBar } from "./MobileTabBar";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const setBuildingId = useUiStore((s) => s.setBuildingId);
  const openAlarms = useSim(selectOpenAlarmCount);

  // Keep the switcher in step with the URL when a building page is opened directly.
  useEffect(() => {
    const id = buildingIdForPath(pathname);
    if (id && getBuilding(id)) setBuildingId(id);
  }, [pathname, setBuildingId]);

  // Tablets (primary device) start with the icon-only sidebar to leave room for content.
  useEffect(() => {
    if (window.innerWidth < 1280) useUiStore.setState({ sidebarCollapsed: true });
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <SimRunner />
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar openAlarms={openAlarms} />
          <main className="flex-1 px-4 pb-24 pt-4 md:px-6 md:pb-8 md:pt-6">
            {/* Reads ?panel=…, which only exists in the browser. */}
            <Suspense fallback={null}>
              <Breadcrumbs />
            </Suspense>
            {children}
          </main>
        </div>
      </div>
      <MobileTabBar />
      <AlarmToaster />
      <Presenter />
      <Kiosk />
    </TooltipProvider>
  );
}
