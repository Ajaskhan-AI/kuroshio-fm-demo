"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { useSim } from "@/lib/sim/store";

/** If a screen ever fails mid-demo: say so plainly and offer a one-tap recovery. */
export default function ScreenError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-bold">This screen hit a problem</h1>
      <p className="text-muted-foreground">The rest of the demo is fine. Reset the simulation to carry on.</p>
      <button
        type="button"
        onClick={() => {
          useSim.getState().reset();
          reset();
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        <RotateCcw className="size-4" aria-hidden /> Reset and reload this screen
      </button>
    </div>
  );
}
