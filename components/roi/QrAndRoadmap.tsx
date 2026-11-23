"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Activity, Building2, Droplets, Gauge, Link2, Wind, Zap, type LucideIcon } from "lucide-react";

/** QR code to this demo's own address, drawn locally (no QR web service). */
export function SiteQr() {
  const [svg, setSvg] = useState<string | null>(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    const u = window.location.origin;
    QRCode.toString(u, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0F1A30", light: "#FFFFFF" } })
      .then((s) => {
        setUrl(u.replace(/^https?:\/\//, ""));
        setSvg(s);
      })
      .catch(() => setSvg(null));
  }, []);

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 text-center">
      <p className="font-semibold">Take the demo with you</p>
      <div
        className="size-44 rounded-lg bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
        role="img"
        aria-label={url ? `QR code for ${url}` : "QR code"}
        // SVG markup generated locally by the qrcode library from our own URL.
        dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
      />
      <p className="text-sm text-muted-foreground">
        Scan to open <span className="font-medium text-foreground">{url || "this demo"}</span> on your phone.
      </p>
    </div>
  );
}

const NEXT: { label: string; icon: LucideIcon }[] = [
  { label: "Chiller kW/TR", icon: Gauge },
  { label: "Indoor air quality", icon: Wind },
  { label: "Water leak detection", icon: Droplets },
  { label: "Generator readiness", icon: Zap },
  { label: "Lift uptime", icon: Building2 },
  { label: "CAFM integration", icon: Link2 },
];

/** Roadmap only. Never shown as live features (CLAUDE.md §2 rule 4). */
export function ComingNext() {
  return (
    <section aria-labelledby="next-heading" className="rounded-xl border border-dashed border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="next-heading" className="flex items-center gap-2 font-semibold">
          <Activity className="size-5 text-primary" aria-hidden /> Coming next
        </h2>
        <span className="text-xs text-muted-foreground">On the roadmap, not in the product yet</span>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {NEXT.map(({ label, icon: Icon }) => (
          <li key={label} className="flex min-h-11 items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
