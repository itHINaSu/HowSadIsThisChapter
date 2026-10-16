// A full-width row with a label and a checkbox (filters, settings).
import type { InputHTMLAttributes, ReactNode } from "react";

export function ToggleRow({ label, ...input }: { label: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="toggle flex min-h-12 cursor-pointer items-center justify-between gap-3.5 border-b border-foreground/15 py-1.5 font-bold last:border-b-0">
      <span>{label}</span>
      <input type="checkbox" className="size-6 flex-none accent-primary" {...input} />
    </label>
  );
}
