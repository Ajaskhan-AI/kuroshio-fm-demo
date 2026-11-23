"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { BUILDINGS } from "@/lib/buildings";
import { fmtKw } from "@/lib/format";
import { CITY_LABELS, COAST_PATH, LAND_PATH, MAP_H, MAP_W, PALM_PATH, SEA_LABEL, layoutPins, project } from "@/lib/geo";
import { buildingHref } from "@/lib/links";
import type { BuildingLive, HealthStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatusChip, statusFillVar } from "@/components/cards/StatusChip";

const GLYPH: Record<HealthStatus, string> = { online: "✓", warning: "!", alarm: "!", offline: "–" };

/** Which side of the pin the name sits on, so labels don't collide on the crowded Dubai coast. */
const LABEL_SIDE: Record<string, "left" | "right"> = {
  "marina-a": "left",
  "jlt-one": "left",
  "bb-plaza": "right",
  "deira-annex": "left",
  "sharjah-hub": "right",
  "reem-res": "right",
};

/** Pin radius from design peak load, so layout never jitters with live values. */
const radiusFor = (peakKw: number) => 10 + 10 * Math.min(1, peakKw / 1200);

export function UaeMap({
  buildings,
  hoveredId,
  onHover,
}: {
  buildings: Record<string, BuildingLive>;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}) {
  const router = useRouter();
  // Peak load is fixed per building, so this string only changes once, when the portfolio loads.
  const peaksKey = BUILDINGS.map((b) => buildings[b.id]?.peakKw ?? 600).join(",");
  const pins = useMemo(() => {
    const peaks = peaksKey.split(",").map(Number);
    return layoutPins(BUILDINGS.map((b, i) => ({ id: b.id, lat: b.lat, lng: b.lng, r: radiusFor(peaks[i]) })));
  }, [peaksKey]);

  const hovered = hoveredId ? pins.find((p) => p.id === hoveredId) : undefined;
  const hb = hoveredId ? buildings[hoveredId] : undefined;
  const open = (id: string) => router.push(buildingHref(id));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="block h-auto w-full" role="group" aria-label="Map of the portfolio along the UAE coast">
        <rect width={MAP_W} height={MAP_H} fill="color-mix(in srgb, var(--primary) 16%, var(--card))" />
        {/* Faint graticule */}
        <g stroke="var(--primary)" strokeOpacity={0.07} strokeWidth={1}>
          {[54.25, 54.5, 54.75, 55, 55.25, 55.5].map((lng) => {
            const { x } = project(25, lng);
            return <line key={lng} x1={x} x2={x} y1={0} y2={MAP_H} />;
          })}
          {[24.5, 24.75, 25, 25.25, 25.5].map((lat) => {
            const { y } = project(lat, 55);
            return <line key={lat} x1={0} x2={MAP_W} y1={y} y2={y} />;
          })}
        </g>
        <path d={LAND_PATH} fill="var(--card)" />
        <path d={COAST_PATH} fill="none" stroke="color-mix(in srgb, var(--primary) 45%, var(--card))" strokeWidth={2} strokeLinejoin="round" />
        <path d={PALM_PATH} fill="none" stroke="color-mix(in srgb, var(--primary) 45%, var(--card))" strokeWidth={2.5} strokeLinecap="round" />

        <text
          {...(({ x, y }) => ({ x, y }))(project(SEA_LABEL.lat, SEA_LABEL.lng))}
          className="fill-primary/40 text-[15px] italic tracking-[0.2em]"
          textAnchor="middle"
        >
          {SEA_LABEL.name.toUpperCase()}
        </text>
        {CITY_LABELS.map((c) => {
          const { x, y } = project(c.lat, c.lng);
          return (
            <text key={c.name} x={x} y={y} className="fill-muted-foreground text-[13px] font-semibold uppercase tracking-wider" textAnchor="middle">
              {c.name}
            </text>
          );
        })}

        {pins.map((p) => {
          const b = buildings[p.id];
          if (!b) return null;
          const isHover = hoveredId === p.id;
          const fill = statusFillVar[b.status];
          const side = LABEL_SIDE[p.id] ?? "right";
          const name = b.info.name;
          return (
            <g
              key={p.id}
              role="link"
              tabIndex={0}
              aria-label={`${name}: ${b.status === "online" ? "normal" : b.status}, ${fmtKw(b.kw)}, ${b.openAlarms} open alarms. Open building.`}
              className="cursor-pointer outline-none"
              onMouseEnter={() => onHover(p.id)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(p.id)}
              onBlur={() => onHover(null)}
              onClick={() => open(p.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  open(p.id);
                }
              }}
            >
              {(Math.abs(p.x - p.x0) > 3 || Math.abs(p.y - p.y0) > 3) && (
                <>
                  <line x1={p.x0} y1={p.y0} x2={p.x} y2={p.y} stroke="var(--muted-foreground)" strokeWidth={1.25} strokeDasharray="3 3" />
                  <circle cx={p.x0} cy={p.y0} r={3} fill="var(--muted-foreground)" />
                </>
              )}
              {b.status === "alarm" && <circle cx={p.x} cy={p.y} r={p.r} fill={fill} className="kfm-pulse" />}
              {/* Larger invisible hit area for touch (≥ 44 px). */}
              <circle cx={p.x} cy={p.y} r={Math.max(p.r + 8, 24)} fill="transparent" />
              <circle
                cx={p.x}
                cy={p.y}
                r={p.r}
                fill={fill}
                stroke={isHover ? "var(--foreground)" : "var(--card)"}
                strokeWidth={isHover ? 3.5 : 3}
                style={{ transition: "stroke 150ms" }}
              />
              <text x={p.x} y={p.y} dy="0.36em" textAnchor="middle" className="pointer-events-none fill-white text-[15px] font-extrabold">
                {GLYPH[b.status]}
              </text>
              <text
                x={side === "right" ? p.x + p.r + 7 : p.x - p.r - 7}
                y={p.y}
                dy="0.35em"
                textAnchor={side === "right" ? "start" : "end"}
                className={cn("pointer-events-none text-[14px] font-semibold", isHover ? "fill-foreground" : "fill-foreground/80")}
                paintOrder="stroke"
                stroke="var(--card)"
                strokeWidth={4}
                strokeLinejoin="round"
              >
                {name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip, positioned in % so it tracks the responsive SVG. */}
      {hovered && hb && (
        <div
          className="pointer-events-none absolute z-10 w-64 -translate-x-1/2 rounded-lg border border-border bg-popover p-3 text-sm shadow-lg"
          style={{
            left: `${Math.min(85, Math.max(15, (hovered.x / MAP_W) * 100))}%`,
            top: `${(hovered.y / MAP_H) * 100}%`,
            transform: hovered.y / MAP_H > 0.55 ? "translate(-50%, calc(-100% - 28px))" : "translate(-50%, 28px)",
          }}
          role="tooltip"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold leading-snug text-foreground">{hb.info.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {hb.info.area} · {hb.info.type}
              </p>
            </div>
            <StatusChip status={hb.status} />
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-2 tabular-nums">
            <div>
              <dt className="text-xs text-muted-foreground">Live load</dt>
              <dd className="font-semibold">{fmtKw(hb.kw)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Open alarms</dt>
              <dd className="font-semibold">{hb.openAlarms}</dd>
            </div>
          </dl>
          {hb.topIssue && <p className="mt-2 truncate text-xs text-muted-foreground">Top issue: {hb.topIssue}</p>}
          <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary">
            Click to open building <ArrowRight className="size-3" aria-hidden />
          </p>
        </div>
      )}
    </div>
  );
}
