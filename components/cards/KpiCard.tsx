"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { timeAgo } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { cn } from "@/lib/utils";

/** "Updated 4 s ago" — every live card shows it (CLAUDE.md §5). */
export function UpdatedAgo({ at, className }: { at: number | undefined; className?: string }) {
  const now = useNow(1000);
  return (
    <span className={cn("text-xs tabular-nums text-muted-foreground", className)} suppressHydrationWarning>
      {at && now ? `Updated ${timeAgo(at, now)}` : "Updated just now"}
    </span>
  );
}

/** Card anatomy everywhere: title → big number → trend → status chip. */
export function KpiCard({
  title,
  value,
  sub,
  trend,
  chip,
  updatedAt,
  href,
  className,
}: {
  title: string;
  value: ReactNode;
  sub?: ReactNode;
  trend?: ReactNode;
  chip?: ReactNode;
  updatedAt?: number;
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        {chip}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-[2rem]">{value}</div>
      {sub && <div className="mt-1 text-sm text-muted-foreground">{sub}</div>}
      <div className="mt-auto flex items-end justify-between gap-2 pt-3">
        <UpdatedAgo at={updatedAt} />
        {trend}
      </div>
    </>
  );
  const cls = cn(
    "flex min-h-40 flex-col rounded-xl border border-border bg-card p-4 shadow-xs md:p-5",
    href && "transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-ring",
    className,
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <section className={cls}>{body}</section>
  );
}
