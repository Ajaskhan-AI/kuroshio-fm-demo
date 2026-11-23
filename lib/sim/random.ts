// Seeded randomness so history and the portfolio look the same on every reload (CLAUDE.md §7).

export type Rng = () => number;

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A generator seeded from any mix of keys, e.g. rngFor("marina-a", "SMDB-04"). */
export function rngFor(...parts: (string | number)[]): Rng {
  return mulberry32(hashString(parts.join("|")));
}

/** Deterministic noise in [-1, 1] for a key. */
export function noise(...parts: (string | number)[]): number {
  return rngFor(...parts)() * 2 - 1;
}

export const between = (r: Rng, min: number, max: number) => min + r() * (max - min);
export const pick = <T>(r: Rng, items: readonly T[]): T => items[Math.floor(r() * items.length)];

/** Live (non-seeded) jitter of ±pct around 1. */
export const jitter = (pct: number) => 1 + (Math.random() * 2 - 1) * pct;

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
