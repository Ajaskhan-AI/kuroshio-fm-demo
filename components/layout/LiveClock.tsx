"use client";

import { useEffect, useState } from "react";

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dubai",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Dubai local time. Renders a fixed placeholder on the server to avoid a hydration mismatch. */
export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="hidden items-baseline gap-1.5 text-sm tabular-nums text-muted-foreground lg:inline-flex">
      <time suppressHydrationWarning>{now ? fmt.format(now) : "--:--:--"}</time>
      <span className="text-xs">GST</span>
    </span>
  );
}
