"use client";

import { useEffect, useState } from "react";

/** Wall clock that re-renders every `intervalMs`; null until mounted (avoids hydration mismatch). */
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const id = setInterval(update, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
