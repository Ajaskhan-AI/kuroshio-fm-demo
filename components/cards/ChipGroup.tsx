"use client";

import { cn } from "@/lib/utils";

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Single-choice filter as chips, not a dropdown (CLAUDE.md §5). Scrolls sideways on phones. */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: ChipOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex min-w-0 items-center gap-2", className)}>
      <span className="hidden w-20 shrink-0 text-xs font-medium text-muted-foreground sm:block">{label}</span>
      <div className="no-scrollbar -mx-4 min-w-0 flex-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {options.map((o) => {
            const on = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange(o.value)}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50",
                  )}
                >
                  {o.label}
                  {o.count !== undefined && (
                    <span className={cn("rounded-full px-1.5 text-xs tabular-nums", on ? "bg-white/20" : "bg-muted text-muted-foreground")}>
                      {o.count}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
