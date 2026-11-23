// Units and number formatting. Every live value is shown with its unit (CLAUDE.md §5).

const formatters = new Map<number, Intl.NumberFormat>();
function nf(decimals: number): Intl.NumberFormat {
  let f = formatters.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    formatters.set(decimals, f);
  }
  return f;
}

export const fmtNum = (v: number, decimals = 0) => nf(decimals).format(v);

export const fmtKw = (v: number) => `${fmtNum(v, Math.abs(v) < 100 ? 1 : 0)} kW`;
export const fmtKwh = (v: number) => `${fmtNum(v, Math.abs(v) < 100 ? 1 : 0)} kWh`;
export const fmtMwh = (v: number) => `${fmtNum(v, 1)} MWh`;
export const fmtAed = (v: number) => `AED ${fmtNum(v, Math.abs(v) < 1_000 ? 2 : 0)}`;
export const fmtTemp = (v: number) => `${fmtNum(v, 1)} °C`;
export const fmtV = (v: number) => `${fmtNum(v, 0)} V`;
export const fmtA = (v: number) => `${fmtNum(v, v < 100 ? 1 : 0)} A`;
export const fmtPf = (v: number) => fmtNum(v, 2);
export const fmtPct = (v: number, decimals = 0) => `${fmtNum(v, decimals)}%`;
export const fmtTco2e = (v: number) => `${fmtNum(v, v < 10 ? 2 : 1)} tCO₂e`;
export const fmtPa = (v: number) => `${fmtNum(v, 0)} Pa`;

/** "just now", "12 s ago", "4 min ago", "2 h ago". */
export function timeAgo(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 2) return "just now";
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

/** "45 s", "12 min", "3 h 20 min", "2 d 4 h". */
export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}

/** SLA countdown, "29:41" or "3:59:12"; negative values are shown as overdue by the caller. */
export function fmtCountdown(ms: number): string {
  const total = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const dubaiTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit", hour12: false });
const dubaiDate = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "numeric", month: "short" });

export const fmtTime = (ts: number) => dubaiTime.format(ts);
export const fmtDate = (ts: number) => dubaiDate.format(ts);
