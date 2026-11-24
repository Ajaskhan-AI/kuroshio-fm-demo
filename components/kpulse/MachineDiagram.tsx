"use client";

import { statusFillVar } from "@/components/cards/StatusChip";
import { pointVelocity, zoneOf } from "@/lib/kpulse/physics";
import { pointLabel, zoneStatus } from "@/lib/kpulse/selectors";
import type { RotatingAsset, SensorPoint } from "@/lib/kpulse/types";
import { fmtNum } from "@/lib/format";

const POS: Record<SensorPoint, number> = { "motor-nde": 70, "motor-de": 200, "machine-de": 330, "machine-nde": 470 };

function Machine({ kind }: { kind: RotatingAsset["kind"] }) {
  const s = { fill: "var(--muted)", stroke: "var(--muted-foreground)", strokeWidth: 1.5 };
  if (kind === "pump")
    return (
      <g>
        <rect x={300} y={92} width={60} height={36} rx={6} {...s} />
        <circle cx={420} cy={110} r={50} {...s} />
        <circle cx={420} cy={110} r={18} fill="var(--card)" stroke="var(--muted-foreground)" strokeWidth={1.5} />
        <rect x={405} y={28} width={30} height={34} rx={3} {...s} />
        <rect x={470} y={98} width={46} height={24} rx={3} {...s} />
      </g>
    );
  if (kind === "fan")
    return (
      <g>
        <rect x={300} y={92} width={50} height={36} rx={6} {...s} />
        <circle cx={425} cy={110} r={62} {...s} />
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <ellipse key={deg} cx={425} cy={80} rx={10} ry={26} fill="var(--card)" stroke="var(--muted-foreground)" strokeWidth={1.2} transform={`rotate(${deg} 425 110)`} />
        ))}
        <circle cx={425} cy={110} r={10} fill="var(--muted-foreground)" />
      </g>
    );
  return (
    <g>
      <rect x={300} y={92} width={40} height={36} rx={6} {...s} />
      <rect x={340} y={58} width={160} height={104} rx={18} {...s} />
      <path d="M360 80 Q420 110 360 140 M400 80 Q460 110 400 140 M440 80 Q500 110 440 140" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.2} />
    </g>
  );
}

/** The drive train with its four sensor points, each coloured and lettered by its ISO zone. */
export function MachineDiagram({ asset: a, selected, onSelect }: { asset: RotatingAsset; selected: SensorPoint; onSelect: (pt: SensorPoint) => void }) {
  return (
    <figure className="w-full">
      <svg viewBox="0 0 560 230" className="h-auto w-full" role="group" aria-label={`${a.name}: motor and ${a.kind} with four vibration sensors`}>
        {/* Base frame */}
        <rect x={20} y={168} width={520} height={10} rx={3} fill="var(--border)" />
        {/* Motor with cooling fins */}
        <rect x={40} y={62} width={190} height={96} rx={12} fill="var(--muted)" stroke="var(--muted-foreground)" strokeWidth={1.5} />
        {[78, 94, 110, 126, 142].map((y) => (
          <line key={y} x1={58} x2={212} y1={y} y2={y} stroke="var(--muted-foreground)" strokeOpacity={0.35} />
        ))}
        <text x={135} y={52} textAnchor="middle" fontSize={13} fill="var(--muted-foreground)">
          Motor
        </text>
        {/* Shaft and coupling */}
        <rect x={230} y={104} width={72} height={12} fill="var(--muted-foreground)" opacity={0.6} />
        <rect x={256} y={94} width={20} height={32} rx={3} fill="var(--card)" stroke="var(--muted-foreground)" strokeWidth={1.5} />
        <Machine kind={a.kind} />
        <text x={420} y={a.kind === "pump" ? 20 : 44} textAnchor="middle" fontSize={13} fill="var(--muted-foreground)">
          {a.kind === "pump" ? "Pump" : a.kind === "fan" ? "Fan" : "Compressor"}
        </text>

        {(Object.keys(POS) as SensorPoint[]).map((pt) => {
          const r = a.readings.points[pt];
          const v = pointVelocity(r);
          const zone = zoneOf(v, a.iso);
          const status = a.tripped ? "offline" : zoneStatus[zone];
          const x = POS[pt];
          const on = pt === selected;
          return (
            <g
              key={pt}
              role="button"
              tabIndex={0}
              aria-pressed={on}
              aria-label={`${pointLabel(a, pt)}: ${fmtNum(v, 1)} mm/s, zone ${zone}`}
              onClick={() => onSelect(pt)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(pt);
                }
              }}
              className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-[var(--ring)]"
            >
              <circle cx={x} cy={110} r={on ? 24 : 20} fill="var(--card)" stroke={on ? "var(--primary)" : "transparent"} strokeWidth={3} />
              <circle cx={x} cy={110} r={15} fill={statusFillVar[status]} />
              <text x={x} y={110} dominantBaseline="central" textAnchor="middle" fontSize={14} fontWeight={700} fill="#fff">
                {a.tripped ? "–" : zone}
              </text>
              <text x={x} y={200} textAnchor="middle" fontSize={12} fontWeight={on ? 700 : 500} fill="var(--foreground)">
                {pointLabel(a, pt)}
              </text>
              <text x={x} y={218} textAnchor="middle" fontSize={12} fill="var(--muted-foreground)" className="tabular-nums">
                {fmtNum(v, 1)} mm/s
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">Tap a sensor point to show its readings in the charts.</figcaption>
    </figure>
  );
}
