// Simple equirectangular projection for the hand-drawn UAE coast map (no tiles, no map library).

export const MAP_W = 800;
export const MAP_H = 600;

const BOUNDS = { west: 54.15, east: 55.68, south: 24.32, north: 25.5 };
const COS_LAT = Math.cos((24.9 * Math.PI) / 180);

const spanX = (BOUNDS.east - BOUNDS.west) * COS_LAT;
const spanY = BOUNDS.north - BOUNDS.south;
const SCALE = Math.min(MAP_W / spanX, MAP_H / spanY);
const OFFSET_X = (MAP_W - spanX * SCALE) / 2;
const OFFSET_Y = (MAP_H - spanY * SCALE) / 2;

export function project(lat: number, lng: number): { x: number; y: number } {
  return {
    x: OFFSET_X + (lng - BOUNDS.west) * COS_LAT * SCALE,
    y: OFFSET_Y + (BOUNDS.north - lat) * SCALE,
  };
}

/**
 * Approximate Gulf coastline from west of Abu Dhabi to past Ajman, [lng, lat], south-west → north-east.
 * Hand-simplified: recognisable, not survey-grade.
 */
const COAST: [number, number][] = [
  [53.9, 24.2],
  [54.12, 24.27],
  [54.24, 24.33],
  [54.31, 24.42],
  [54.35, 24.49],
  [54.42, 24.53],
  [54.5, 24.5],
  [54.58, 24.55],
  [54.68, 24.63],
  [54.77, 24.74],
  [54.86, 24.84],
  [54.96, 24.93],
  [55.02, 24.99],
  [55.08, 25.04],
  [55.13, 25.08],
  [55.15, 25.1],
  [55.2, 25.15],
  [55.25, 25.21],
  [55.28, 25.26],
  [55.31, 25.27],
  [55.35, 25.3],
  [55.39, 25.35],
  [55.44, 25.4],
  [55.5, 25.46],
  [55.56, 25.52],
  [55.63, 25.6],
  [55.9, 25.85],
];

function pathFrom(points: [number, number][]): string {
  return points
    .map(([lng, lat], i) => {
      const { x, y } = project(lat, lng);
      return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join("");
}

/** Land polygon: the coast, then round the south-east corner. */
export const LAND_PATH = `${pathFrom(COAST)}L${MAP_W + 50},${MAP_H + 50}L-50,${MAP_H + 50}Z`;
export const COAST_PATH = pathFrom(COAST);

/** Palm Jumeirah, simplified to a trunk and crescent so Dubai reads at a glance. */
export const PALM_PATH = (() => {
  const base = project(25.1, 55.145);
  const tip = project(25.125, 55.13);
  const c = project(25.13, 55.125);
  return `M${base.x.toFixed(1)},${base.y.toFixed(1)}L${tip.x.toFixed(1)},${tip.y.toFixed(1)}M${(c.x - 9).toFixed(1)},${(c.y + 4).toFixed(1)}A10,10 0 0 1 ${(c.x + 9).toFixed(1)},${(c.y - 4).toFixed(1)}`;
})();

export const CITY_LABELS = [
  { name: "Abu Dhabi", lat: 24.4, lng: 54.5 },
  { name: "Dubai", lat: 25.02, lng: 55.42 },
  { name: "Sharjah", lat: 25.2, lng: 55.6 },
] as const;

export const SEA_LABEL = { name: "Arabian Gulf", lat: 25.25, lng: 54.6 } as const;

export interface PinLayout {
  id: string;
  /** True projected position. */
  x0: number;
  y0: number;
  /** Displayed position after nudging overlapping pins apart. */
  x: number;
  y: number;
  r: number;
}

/** Push overlapping pins apart (Marina and JLT are a few hundred metres apart); a leader line keeps the true spot. */
export function layoutPins(items: { id: string; lat: number; lng: number; r: number }[]): PinLayout[] {
  const pins = items.map((it) => {
    const { x, y } = project(it.lat, it.lng);
    return { id: it.id, x0: x, y0: y, x, y, r: it.r };
  });
  for (let iter = 0; iter < 60; iter++) {
    for (let i = 0; i < pins.length; i++) {
      for (let j = i + 1; j < pins.length; j++) {
        const a = pins[i];
        const b = pins[j];
        const min = a.r + b.r + 26;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= min) continue;
        if (d < 0.01) {
          // Same spot: split along the coast's normal so pins stay on land / sea edge sensibly.
          dx = 0.6;
          dy = 0.8;
          d = 1;
        }
        const push = (min - d) / 2;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
      }
    }
  }
  return pins;
}
