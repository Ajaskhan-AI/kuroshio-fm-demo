import { AlertOctagon, AlertTriangle, CheckCircle2, WifiOff } from "lucide-react";
import { CONFIG } from "@/lib/config";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

const MIN = 20;
const MAX = 80;
const R = 80;
const CX = 100;
const CY = 96;

/** Point on the semicircle for a temperature (left = MIN, right = MAX). */
function pt(t: number, r = R) {
  const f = (Math.min(MAX, Math.max(MIN, t)) - MIN) / (MAX - MIN);
  const a = Math.PI * (1 - f);
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
}

function arc(from: number, to: number, r = R) {
  const a = pt(from, r);
  const b = pt(to, r);
  return `M${a.x.toFixed(2)},${a.y.toFixed(2)}A${r},${r} 0 0 1 ${b.x.toFixed(2)},${b.y.toFixed(2)}`;
}

/** Panel temperature with the bands from CLAUDE.md §6.2: normal < 45 °C, warning 45–60 °C, alarm > 60 °C. */
export function TempGauge({ tempC, offline }: { tempC: number; offline?: boolean }) {
  const { panelTempWarnC: warn, panelTempAlarmC: alarm } = CONFIG.thresholds;
  const level = offline ? "offline" : tempC > alarm ? "alarm" : tempC > warn ? "warning" : "normal";
  const color = { normal: "var(--success)", warning: "var(--warning)", alarm: "var(--danger)", offline: "var(--offline)" }[level];
  const label = { normal: "Normal", warning: "Running hot", alarm: "Overheating", offline: "No data" }[level];
  const Icon = { normal: CheckCircle2, warning: AlertTriangle, alarm: AlertOctagon, offline: WifiOff }[level];
  const needle = pt(tempC, R + 10);
  const needleIn = pt(tempC, R - 18);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 112" className="w-full max-w-[260px]" role="img" aria-label={`Panel temperature ${fmtNum(tempC, 1)} °C, ${label}`}>
        <path d={arc(MIN, warn)} stroke="var(--success)" strokeOpacity={0.25} strokeWidth={14} fill="none" />
        <path d={arc(warn, alarm)} stroke="var(--warning)" strokeOpacity={0.3} strokeWidth={14} fill="none" />
        <path d={arc(alarm, MAX)} stroke="var(--danger)" strokeOpacity={0.3} strokeWidth={14} fill="none" />
        <path d={arc(MIN, Math.max(MIN + 0.01, tempC))} stroke={color} strokeWidth={14} fill="none" style={{ transition: "d 600ms ease-out" }} />
        <line x1={needleIn.x} y1={needleIn.y} x2={needle.x} y2={needle.y} stroke="var(--foreground)" strokeWidth={3} strokeLinecap="round" />
        {[warn, alarm].map((t) => {
          const p = pt(t, R + 14);
          return (
            <text key={t} x={p.x} y={p.y} textAnchor="middle" dy="0.3em" className="fill-muted-foreground text-[9px] tabular-nums">
              {t}
            </text>
          );
        })}
        <text x={CX} y={CY - 14} textAnchor="middle" className="fill-foreground text-[30px] font-bold tabular-nums">
          {fmtNum(tempC, 1)}
        </text>
        <text x={CX} y={CY + 6} textAnchor="middle" className="fill-muted-foreground text-[11px]">
          °C
        </text>
      </svg>
      <span
        className={cn(
          "mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold",
          level === "normal" && "bg-success-tint text-success",
          level === "warning" && "bg-warning/15 text-foreground [&_svg]:text-warning",
          level === "alarm" && "bg-danger-strong text-white",
          level === "offline" && "bg-offline/15 text-muted-foreground",
        )}
      >
        <Icon className="size-4" aria-hidden />
        {label}
      </span>
      <p className="mt-2 text-xs text-muted-foreground">
        Normal below {warn} °C · alarm above {alarm} °C
      </p>
    </div>
  );
}
