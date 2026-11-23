"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertOctagon, AlertTriangle, X } from "lucide-react";
import { getBuilding } from "@/lib/buildings";
import { alarmHref } from "@/lib/links";
import { useSim } from "@/lib/sim/store";
import type { Alarm } from "@/lib/types";
import { cn } from "@/lib/utils";

const SHOW_MS = 7_000;
const MAX = 3;

/**
 * New P1 / P2 alarms slide in as toasts wherever you are (CLAUDE.md §5).
 * P3 alarms only update the bell, so random minor events don't nag during a demo.
 */
export function AlarmToaster() {
  const alarms = useSim((s) => s.alarms);
  const ready = useSim((s) => s.ready);
  const startedAt = useSim((s) => s.startedAt);
  const seen = useRef<Set<string> | null>(null);
  const seenStart = useRef(0);
  const [toasts, setToasts] = useState<Alarm[]>([]);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!ready) return;
    // First run, or the simulation was reset: everything already there counts as seen.
    if (!seen.current || seenStart.current !== startedAt) {
      seen.current = new Set(alarms.map((a) => a.id));
      seenStart.current = startedAt;
      setToasts([]);
      return;
    }
    const fresh = alarms.filter((a) => !seen.current!.has(a.id));
    fresh.forEach((a) => seen.current!.add(a.id));
    const loud = fresh.filter((a) => a.priority !== "P3" && a.status !== "cleared");
    if (loud.length) setToasts((t) => [...loud, ...t].slice(0, MAX));
  }, [alarms, ready, startedAt]);

  useEffect(() => {
    if (!toasts.length) return;
    const oldest = toasts[toasts.length - 1];
    const id = setTimeout(() => setToasts((t) => t.filter((x) => x.id !== oldest.id)), SHOW_MS);
    return () => clearTimeout(id);
  }, [toasts]);

  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex flex-col items-end gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:w-96"
    >
      <AnimatePresence initial={false}>
        {toasts.map((a) => {
          const critical = a.priority === "P1";
          const Icon = critical ? AlertOctagon : AlertTriangle;
          return (
            <motion.div
              key={a.id}
              layout={!reduce}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 48 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: 48 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              role="alert"
              className={cn(
                "pointer-events-auto flex w-full items-start gap-3 rounded-xl border p-3 shadow-lg",
                critical ? "border-danger-strong bg-danger-strong text-white" : "border-warning/50 bg-popover text-foreground",
              )}
            >
              <Icon className={cn("mt-0.5 size-5 shrink-0", critical ? "text-white" : "text-warning")} aria-hidden />
              <Link href={alarmHref(a)} onClick={() => dismiss(a.id)} className="min-w-0 flex-1">
                <p className="text-sm font-bold">
                  {a.priority} · {a.title}
                </p>
                <p className={cn("truncate text-sm", critical ? "text-white" : "text-muted-foreground")}>
                  {getBuilding(a.buildingId)?.name} · {a.detail}
                </p>
                <p className={cn("mt-1 text-xs font-semibold", critical ? "text-white" : "text-primary")}>
                  View cause{a.workOrderId ? ` · ${a.workOrderId} created` : ""}
                </p>
              </Link>
              <button
                type="button"
                onClick={() => dismiss(a.id)}
                aria-label="Dismiss"
                className={cn("-m-1 grid size-9 shrink-0 place-items-center rounded-lg", critical ? "hover:bg-white/15" : "hover:bg-muted")}
              >
                <X className="size-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
