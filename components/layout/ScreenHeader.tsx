import type { ReactNode } from "react";

/** Page title row. `badge` is for labels such as "Pilot-ready". */
export function ScreenHeader({ title, subtitle, badge }: { title: string; subtitle?: string; badge?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground md:text-base">{subtitle}</p>}
      </div>
      {badge}
    </div>
  );
}
