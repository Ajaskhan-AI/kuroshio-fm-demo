"use client";

import Link from "next/link";
import { Bell, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuildingSwitcher } from "./BuildingSwitcher";
import { LiveClock } from "./LiveClock";
import { LogoMark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

/** Shown on every screen (CLAUDE.md §2 rule 2). */
export function DemoDataLabel() {
  return (
    <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 text-xs font-semibold text-foreground">
      <FlaskConical className="size-3.5 text-warning" aria-hidden />
      Demo data
    </span>
  );
}

export function TopBar({ openAlarms = 0 }: { openAlarms?: number }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:gap-3 md:px-6">
      <Link href="/" className="md:hidden" aria-label="Kuroshio AI home">
        <LogoMark className="size-9" />
      </Link>
      <BuildingSwitcher />

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
        <DemoDataLabel />
        <LiveClock />
        <Button asChild variant="ghost" size="icon" className="relative size-11">
          <Link href="/alarms" aria-label={`Alarms, ${openAlarms} open`}>
            <Bell className="size-5" />
            {openAlarms > 0 && (
              <span className="absolute right-1.5 top-1.5 min-w-5 rounded-full bg-danger px-1 text-center text-[11px] font-bold leading-5 text-white tabular-nums">
                {openAlarms}
              </span>
            )}
          </Link>
        </Button>
        <span className="hidden md:inline-flex">
          <ThemeToggle />
        </span>
      </div>
    </header>
  );
}
