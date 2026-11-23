import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";

/** Unknown building or screen: stay inside the app shell and offer a way back. */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-accent text-primary">
        <Building2 className="size-7" aria-hidden />
      </span>
      <h1 className="text-2xl font-bold">We couldn&apos;t find that page</h1>
      <p className="text-muted-foreground">The building or screen in this link isn&apos;t part of the demo portfolio.</p>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to the portfolio
      </Link>
    </div>
  );
}
