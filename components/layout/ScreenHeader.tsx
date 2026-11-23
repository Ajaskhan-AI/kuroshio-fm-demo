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

/** Temporary body for screens that later build steps fill in. */
export function ScreenPlaceholder({ step, points }: { step: number; points: string[] }) {
  return (
    <section className="rounded-xl border border-dashed border-border bg-card p-6">
      <p className="text-sm font-semibold text-primary">Build step {step}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </section>
  );
}
