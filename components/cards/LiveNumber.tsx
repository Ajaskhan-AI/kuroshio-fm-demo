"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

/**
 * A number that glides to each new value instead of jumping. React renders the first value only;
 * after that the animation writes the text, so re-renders never fight it.
 */
export function LiveNumber({ value, format, className }: { value: number; format: (v: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const [initial] = useState(() => format(value));
  const reduce = useReducedMotion();
  const formatRef = useRef(format);
  useLayoutEffect(() => {
    formatRef.current = format;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce || !Number.isFinite(value)) {
      el.textContent = formatRef.current(value);
      shown.current = value;
      return;
    }
    const controls = animate(shown.current, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (v) => {
        shown.current = v;
        el.textContent = formatRef.current(v);
      },
    });
    return () => controls.stop();
  }, [value, reduce]);

  return (
    <span ref={ref} className={className ? `tabular-nums ${className}` : "tabular-nums"}>
      {initial}
    </span>
  );
}
