"use client";

// Pill switch used wherever something is turned on or off — one click applies
// it, no separate Save step.

import { useFormStatus } from "react-dom";

export function ToggleButton({
  on,
  name,
  readOnly,
}: {
  on: boolean;
  /** What is being switched, for the tooltip */
  name: string;
  readOnly?: boolean;
}) {
  const { pending } = useFormStatus();
  const label = on ? "Active" : "Off";
  return (
    <button
      type={readOnly ? "button" : "submit"}
      disabled={readOnly || pending}
      title={readOnly ? `${name} is ${label.toLowerCase()}` : `Turn ${name} ${on ? "off" : "on"}`}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-70 ${
        on
          ? "border-success/50 bg-success/10 text-success hover:border-success"
          : "border-border bg-surface-raised text-muted hover:border-accent hover:text-foreground"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-6 rounded-full p-0.5 transition-colors ${
          on ? "bg-success/70" : "bg-border"
        }`}
      >
        <span
          className={`block h-2.5 w-2.5 rounded-full bg-white transition-transform ${on ? "translate-x-2.5" : ""}`}
        />
      </span>
      {pending ? "…" : label}
    </button>
  );
}
