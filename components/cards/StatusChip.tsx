import { AlertOctagon, AlertTriangle, CheckCircle2, WifiOff, type LucideIcon } from "lucide-react";
import type { HealthStatus, Priority } from "@/lib/types";
import { cn } from "@/lib/utils";

// Status is never colour alone: every chip has an icon and a word (CLAUDE.md §4).
const STATUS: Record<HealthStatus, { label: string; icon: LucideIcon; className: string }> = {
  online: { label: "Normal", icon: CheckCircle2, className: "bg-success-tint text-success" },
  warning: { label: "Warning", icon: AlertTriangle, className: "bg-warning/15 text-foreground [&_svg]:text-warning" },
  alarm: { label: "Alarm", icon: AlertOctagon, className: "bg-danger/12 text-danger" },
  offline: { label: "Offline", icon: WifiOff, className: "bg-offline/15 text-muted-foreground" },
};

export function StatusChip({ status, label, className }: { status: HealthStatus; label?: string; className?: string }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold", s.className, className)}>
      <Icon className="size-3.5" aria-hidden />
      {label ?? s.label}
    </span>
  );
}

const PRIORITY: Record<Priority, { label: string; className: string }> = {
  P1: { label: "P1 · Critical", className: "bg-danger-strong text-white" },
  P2: { label: "P2 · High", className: "bg-warning/20 text-foreground ring-1 ring-warning/50" },
  P3: { label: "P3 · Normal", className: "bg-muted text-muted-foreground ring-1 ring-border" },
};

export function PriorityChip({ priority, short, className }: { priority: Priority; short?: boolean; className?: string }) {
  const p = PRIORITY[priority];
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center rounded-md px-2 text-xs font-bold tabular-nums", p.className, className)}>
      {short ? priority : p.label}
    </span>
  );
}

export const statusTextClass: Record<HealthStatus, string> = {
  online: "text-success",
  warning: "text-warning",
  alarm: "text-danger",
  offline: "text-offline",
};

export const statusFillVar: Record<HealthStatus, string> = {
  online: "var(--success)",
  warning: "var(--warning)",
  alarm: "var(--danger)",
  offline: "var(--offline)",
};
