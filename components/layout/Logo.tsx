import Image from "next/image";
import logo from "@/public/kuroshio-logo.jpg";
import { cn } from "@/lib/utils";

/** Full wordmark. In dark mode it sits on a white chip so the JPG background never shows as a box. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md bg-white px-2 py-1.5", className)}>
      <Image src={logo} alt="Kuroshio AI" priority className="h-4 w-auto" />
    </span>
  );
}

/** Compact mark for the collapsed sidebar. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-label="Kuroshio AI"
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md bg-brand text-base font-extrabold text-white",
        className,
      )}
    >
      K
    </span>
  );
}
