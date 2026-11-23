"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown, Clock, Coins, Leaf, RotateCcw, TrendingUp } from "lucide-react";
import { fmtAedEstimate, fmtNum, fmtPct } from "@/lib/format";
import { ROI_DEFAULT_ASSUMPTIONS, ROI_DEFAULT_INPUTS, calcRoi, type RoiAssumptions, type RoiInputs } from "@/lib/roi";
import { LiveNumber } from "@/components/cards/LiveNumber";

interface SliderSpec<K extends string> {
  key: K;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

/** Slider + number box: drag for speed, type for precision. Touch target ≥ 44 px. */
function Slider<K extends string>({ spec, value, onChange }: { spec: SliderSpec<K>; value: number; onChange: (v: number) => void }) {
  const id = useId();
  const clamp = (v: number) => Math.min(spec.max, Math.max(spec.min, v));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {spec.label}
        </label>
        <span className="text-sm font-bold tabular-nums">{spec.format(value)}</span>
      </div>
      <div className="mt-1 flex items-center gap-3">
        <input
          id={id}
          type="range"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-11 min-w-0 flex-1 cursor-pointer accent-[var(--primary)]"
        />
        <input
          type="number"
          inputMode="decimal"
          aria-label={`${spec.label}, exact value`}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(clamp(v));
          }}
          className="h-11 w-28 rounded-lg border border-input bg-background px-2 text-right text-sm tabular-nums"
        />
      </div>
    </div>
  );
}

const INPUTS: SliderSpec<keyof RoiInputs>[] = [
  { key: "buildings", label: "Buildings", min: 1, max: 50, step: 1, format: (v) => fmtNum(v) },
  { key: "smdbsPerBuilding", label: "SMDBs per building", min: 1, max: 40, step: 1, format: (v) => fmtNum(v) },
  { key: "technicians", label: "Technicians doing manual rounds", min: 1, max: 30, step: 1, format: (v) => fmtNum(v) },
  { key: "hourlyCostAed", label: "Technician cost per hour", min: 20, max: 150, step: 5, format: (v) => `AED ${fmtNum(v)}` },
  { key: "monthlyBillAed", label: "Monthly energy bill, all buildings", min: 50_000, max: 5_000_000, step: 10_000, format: (v) => `AED ${fmtNum(v)}` },
];

const ASSUMPTIONS: SliderSpec<keyof RoiAssumptions>[] = [
  { key: "energySavingPct", label: "Energy saved by fixing waste", min: 5, max: 10, step: 0.5, format: (v) => fmtPct(v, 1) },
  { key: "readingsPerSmdbPerDay", label: "Manual readings per SMDB per day", min: 1, max: 4, step: 1, format: (v) => fmtNum(v) },
  { key: "minutesPerReading", label: "Minutes per reading (walk + read + log)", min: 2, max: 20, step: 1, format: (v) => `${fmtNum(v)} min` },
  { key: "hardwarePerSmdbAed", label: "Hardware + install per SMDB (one-off)", min: 1_000, max: 15_000, step: 250, format: (v) => `AED ${fmtNum(v)}` },
  { key: "monthlyPerSmdbAed", label: "Platform fee per SMDB per month", min: 50, max: 600, step: 10, format: (v) => `AED ${fmtNum(v)}` },
];

function Result({ icon: Icon, label, value, sub }: { icon: typeof Clock; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export function RoiCalculator() {
  const [inputs, setInputs] = useState<RoiInputs>(ROI_DEFAULT_INPUTS);
  const [assume, setAssume] = useState<RoiAssumptions>(ROI_DEFAULT_ASSUMPTIONS);
  const r = useMemo(() => calcRoi(inputs, assume), [inputs, assume]);
  const reset = () => {
    setInputs(ROI_DEFAULT_INPUTS);
    setAssume(ROI_DEFAULT_ASSUMPTIONS);
  };

  const payback =
    r.paybackMonths === null ? "Not at these numbers" : r.paybackMonths < 1 ? "Under 1 month" : `${fmtNum(Math.ceil(r.paybackMonths))} months`;

  return (
    <div className="flex flex-col gap-5">
      {/* Status first: the answer, live. No submit button. */}
      <section aria-live="polite" className="grid gap-3 rounded-xl border border-primary/30 bg-accent p-4 sm:grid-cols-2 md:p-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Estimated saving per year</p>
          <p className="text-3xl font-bold md:text-4xl">
            <LiveNumber value={r.totalSavingAed} format={fmtAedEstimate} />
          </p>
          <p className="text-sm text-muted-foreground">
            {fmtAedEstimate(r.netAnnualAed)} after the platform fee
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Payback</p>
          <p className="text-3xl font-bold md:text-4xl">{payback}</p>
          <p className="text-sm text-muted-foreground">on {fmtAedEstimate(r.oneOffCostAed)} one-off for {fmtNum(r.smdbs)} SMDBs</p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="inputs-heading" className="rounded-xl border border-border bg-card p-4 md:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 id="inputs-heading" className="font-semibold">
              Your portfolio
            </h2>
            <button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground">
              <RotateCcw className="size-4" aria-hidden /> Reset
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-4">
            {INPUTS.map((s) => (
              <Slider key={s.key} spec={s} value={inputs[s.key]} onChange={(v) => setInputs((x) => ({ ...x, [s.key]: v }))} />
            ))}
          </div>

          <details className="group mt-5 rounded-lg border border-border">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-semibold">
              Assumptions (demo values, edit them)
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="flex flex-col gap-4 border-t border-border p-3">
              {ASSUMPTIONS.map((s) => (
                <Slider key={s.key} spec={s} value={assume[s.key]} onChange={(v) => setAssume((x) => ({ ...x, [s.key]: v }))} />
              ))}
              <p className="text-xs text-muted-foreground">Prices here are illustrative for the demo, not a quote. A pilot gives you real numbers.</p>
            </div>
          </details>
        </section>

        <section aria-labelledby="results-heading" className="flex flex-col gap-3 lg:sticky lg:top-20 lg:self-start">
          <h2 id="results-heading" className="font-semibold">
            Where the saving comes from
          </h2>
          <Result
            icon={Clock}
            label="Technician hours saved per year"
            value={<LiveNumber value={r.hoursSavedPerYear} format={(v) => `${fmtNum(v)} h`} />}
            sub={`About ${fmtPct(r.teamTimeFreedPct)} of your ${inputs.technicians}-person rounds team's time, back for real maintenance`}
          />
          <Result icon={Coins} label="Saved on manual rounds" value={<LiveNumber value={r.roundsSavingAed} format={fmtAedEstimate} />} sub="Per year" />
          <Result
            icon={Leaf}
            label="Saved by fixing waste"
            value={<LiveNumber value={r.wasteSavingAed} format={fmtAedEstimate} />}
            sub={`${fmtPct(assume.energySavingPct, 1)} of the energy bill, per year`}
          />
          <Result
            icon={TrendingUp}
            label="Cost"
            value={`${fmtAedEstimate(r.oneOffCostAed)} once`}
            sub={`then ${fmtAedEstimate(r.annualFeeAed)} a year platform fee`}
          />
        </section>
      </div>
    </div>
  );
}
