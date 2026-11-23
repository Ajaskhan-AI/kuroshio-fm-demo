import { CONFIG } from "../config";
import type { WorkOrder } from "../types";
import { DAY, MINUTE } from "./generators";

export const slaMs = (w: Pick<WorkOrder, "priority">) => CONFIG.slaMinutes[w.priority] * MINUTE;

/** Response time, or how long it has been waiting so far. */
export const responseMs = (w: WorkOrder, now: number) => (w.respondedAt ?? now) - w.createdAt;

/** SLA here is response time: a technician must pick the job up within the priority's target. */
export function withinSla(w: WorkOrder, now: number): boolean {
  return responseMs(w, now) <= slaMs(w);
}

export type SlaState = "met" | "on-track" | "at-risk" | "breached";

export function slaState(w: WorkOrder, now: number): SlaState {
  if (w.respondedAt !== undefined) return w.respondedAt - w.createdAt <= slaMs(w) ? "met" : "breached";
  const left = w.slaDueAt - now;
  if (left < 0) return "breached";
  return left < slaMs(w) * 0.25 ? "at-risk" : "on-track";
}

export interface SlaStats {
  total: number;
  /** % of work orders responded to within SLA (open ones already past due count as misses). */
  compliancePct: number | null;
  avgResponseMs: number | null;
  open: number;
  overdue: number;
}

export function slaStats(orders: WorkOrder[], now: number, days = 30): SlaStats {
  const since = now - days * DAY;
  const recent = orders.filter((w) => w.createdAt >= since);
  let judged = 0;
  let met = 0;
  let respSum = 0;
  let respN = 0;
  let open = 0;
  let overdue = 0;
  for (const w of recent) {
    if (w.status !== "closed") open++;
    if (w.respondedAt !== undefined) {
      judged++;
      const r = w.respondedAt - w.createdAt;
      respSum += r;
      respN++;
      if (r <= slaMs(w)) met++;
    } else if (now > w.slaDueAt) {
      judged++;
      overdue++;
    }
  }
  return {
    total: recent.length,
    compliancePct: judged ? (met / judged) * 100 : null,
    avgResponseMs: respN ? respSum / respN : null,
    open,
    overdue,
  };
}
