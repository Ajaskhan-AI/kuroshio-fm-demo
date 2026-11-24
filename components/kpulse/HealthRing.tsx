import { statusFillVar } from "@/components/cards/StatusChip";
import type { HealthStatus } from "@/lib/types";

/** Health score 0–100 as a ring. The number is always printed, so colour is never the only signal. */
export function HealthRing({ value, status, size = 56, label = "Health" }: { value: number; status: HealthStatus; size?: number; label?: string }) {
  const stroke = Math.max(4, Math.round(size / 11));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label} ${Math.round(value)} out of 100`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={statusFillVar[status]}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 600ms ease" }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill="var(--foreground)" fontSize={size * 0.32} fontWeight={700} className="tabular-nums">
        {Math.round(value)}
      </text>
    </svg>
  );
}
