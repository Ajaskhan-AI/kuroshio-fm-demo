"use client";

import { useId, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLES = ["FM director", "Facility manager", "FM engineer", "Chief engineer", "Building owner", "Other"] as const;
const STORAGE_KEY = "kfm-pilot-leads";

interface Lead {
  name: string;
  company: string;
  role: string;
  email: string;
  phone: string;
  buildings: string;
}

const EMPTY: Lead = { name: "", company: "", role: "", email: "", phone: "", buildings: "" };

function validate(l: Lead): Partial<Record<keyof Lead, string>> {
  const e: Partial<Record<keyof Lead, string>> = {};
  if (l.name.trim().length < 2) e.name = "Please enter your name.";
  if (l.company.trim().length < 2) e.company = "Please enter your company.";
  if (!l.role) e.role = "Please pick your role.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(l.email.trim())) e.email = "Please enter a valid email, e.g. name@company.ae.";
  const digits = l.phone.replace(/[\s()-]/g, "");
  if (!/^\+?\d{7,15}$/.test(digits)) e.phone = "Please enter a phone number, e.g. +971 50 123 4567.";
  const n = Number(l.buildings);
  if (!l.buildings || !Number.isInteger(n) || n < 1 || n > 500) e.buildings = "Enter a number of buildings between 1 and 500.";
  return e;
}

function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: (id: string, describedBy: string | undefined) => React.ReactNode;
}) {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(id, error ? errId : undefined)}
      {error ? (
        <p id={errId} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

const inputCls = (bad: boolean) =>
  cn(
    "h-11 w-full rounded-lg border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring",
    bad ? "border-danger" : "border-input",
  );

/** "Book a 30-day pilot". No backend yet: leads are kept on this device (CLAUDE.md §3). */
export function PilotForm({ defaultBuildings }: { defaultBuildings?: number }) {
  const [lead, setLead] = useState<Lead>({ ...EMPTY, buildings: defaultBuildings ? String(defaultBuildings) : "" });
  const [touched, setTouched] = useState<Partial<Record<keyof Lead, boolean>>>({});
  const [submitted, setSubmitted] = useState<string | null>(null);
  const errors = validate(lead);
  const show = (k: keyof Lead) => (touched[k] ? errors[k] : undefined);
  const set = (k: keyof Lead) => (e: React.ChangeEvent<HTMLInputElement>) => setLead((l) => ({ ...l, [k]: e.target.value }));
  const blur = (k: keyof Lead) => () => setTouched((t) => ({ ...t, [k]: true }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, company: true, role: true, email: true, phone: true, buildings: true });
    if (Object.keys(errors).length) {
      const first = (Object.keys(errors) as (keyof Lead)[])[0];
      document.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
      return;
    }
    try {
      const prev = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown[];
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...prev, { ...lead, at: new Date().toISOString() }]));
    } catch {
      // Storage blocked (private mode): the thank-you still shows; the team takes details by hand.
    }
    setSubmitted(lead.name.trim().split(" ")[0]);
  };

  if (submitted) {
    return (
      <div role="status" className="flex flex-col items-start gap-3 rounded-xl border border-success/30 bg-success-tint p-5">
        <CheckCircle2 className="size-8 text-success" aria-hidden />
        <p className="text-lg font-semibold">Thanks, {submitted}. Your pilot request is in.</p>
        <p className="text-sm text-muted-foreground">
          The Kuroshio team will contact you to plan a 30-day pilot on your buildings. Find us on the stand to talk it through now.
        </p>
        <button
          type="button"
          onClick={() => {
            setLead(EMPTY);
            setTouched({});
            setSubmitted(null);
          }}
          className="inline-flex min-h-11 items-center rounded-lg border border-border bg-card px-4 text-sm font-semibold"
        >
          Book another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" error={show("name")}>
        {(id, d) => (
          <input id={id} data-field="name" autoComplete="name" value={lead.name} onChange={set("name")} onBlur={blur("name")} aria-invalid={!!show("name")} aria-describedby={d} className={inputCls(!!show("name"))} />
        )}
      </Field>
      <Field label="Company" error={show("company")}>
        {(id, d) => (
          <input id={id} data-field="company" autoComplete="organization" value={lead.company} onChange={set("company")} onBlur={blur("company")} aria-invalid={!!show("company")} aria-describedby={d} className={inputCls(!!show("company"))} />
        )}
      </Field>

      <fieldset className="sm:col-span-2">
        <legend className="mb-1 text-sm font-medium">Role</legend>
        <div className="flex flex-wrap gap-2" data-field="role" tabIndex={-1}>
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={lead.role === r}
              onClick={() => {
                setLead((l) => ({ ...l, role: r }));
                setTouched((t) => ({ ...t, role: true }));
              }}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm font-medium",
                lead.role === r ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50",
              )}
            >
              {r}
            </button>
          ))}
        </div>
        {show("role") && <p className="mt-1 text-xs font-medium text-danger">{show("role")}</p>}
      </fieldset>

      <Field label="Email" error={show("email")}>
        {(id, d) => (
          <input id={id} data-field="email" type="email" inputMode="email" autoComplete="email" value={lead.email} onChange={set("email")} onBlur={blur("email")} aria-invalid={!!show("email")} aria-describedby={d} className={inputCls(!!show("email"))} />
        )}
      </Field>
      <Field label="Phone" error={show("phone")} hint="Include the country code, e.g. +971">
        {(id, d) => (
          <input id={id} data-field="phone" type="tel" inputMode="tel" autoComplete="tel" value={lead.phone} onChange={set("phone")} onBlur={blur("phone")} aria-invalid={!!show("phone")} aria-describedby={d} className={inputCls(!!show("phone"))} />
        )}
      </Field>
      <Field label="Number of buildings" error={show("buildings")}>
        {(id, d) => (
          <input id={id} data-field="buildings" type="number" inputMode="numeric" min={1} max={500} value={lead.buildings} onChange={set("buildings")} onBlur={blur("buildings")} aria-invalid={!!show("buildings")} aria-describedby={d} className={inputCls(!!show("buildings"))} />
        )}
      </Field>

      <div className="flex flex-col justify-end gap-2 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">Demo: your details stay on this device. Nothing is sent anywhere.</p>
        <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <Send className="size-4" aria-hidden /> Book my 30-day pilot
        </button>
      </div>
    </form>
  );
}
