"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

// ---------- Icons (inline, stroke follows currentColor) ----------

export const Icons = {
  save: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </svg>
  ),
  check: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  plus: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  trash: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
    </svg>
  ),
  edit: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  ),
  send: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  ),
  x: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  upload: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </svg>
  ),
  link: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  power: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
    </svg>
  ),
  key: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  ),
  arrowRight: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  ),
};

export type IconName = keyof typeof Icons;

// Tooltip wrapper: hover shows the label above the control.
function WithTip({ tip, children }: { tip: string; children: React.ReactNode }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-foreground opacity-0 shadow-lg transition-opacity group-hover/tip:opacity-100">
        {tip}
      </span>
    </span>
  );
}

const VARIANTS = {
  primary: "bg-accent text-background hover:bg-accent-strong",
  success: "bg-success text-white hover:bg-success-strong",
  danger: "border border-danger/40 text-danger hover:bg-danger/10",
  outline: "border border-border text-foreground hover:border-accent",
} as const;

/**
 * The platform's standard action button: icon + optional short label,
 * tooltip on hover, pending state inside forms.
 */
export function ActionButton({
  icon,
  tip,
  label,
  variant = "outline",
  type = "submit",
  onClick,
}: {
  icon: IconName;
  tip: string;
  label?: string;
  variant?: keyof typeof VARIANTS;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  const { pending } = useFormStatus();
  return (
    <WithTip tip={tip}>
      <button
        type={type}
        onClick={onClick}
        disabled={type === "submit" && pending}
        aria-label={tip}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${VARIANTS[variant]}`}
      >
        {pending && type === "submit" ? (
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          Icons[icon]
        )}
        {label && <span>{label}</span>}
      </button>
    </WithTip>
  );
}

// Save button with a brief "Saved" confirmation.
export function SaveButton({ label = "Save", tip = "Save changes" }: { label?: string; tip?: string }) {
  const { pending } = useFormStatus();
  const [justSaved, setJustSaved] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 1600);
      return () => clearTimeout(t);
    }
    wasPending.current = pending;
  }, [pending]);

  return (
    <WithTip tip={tip}>
      <button
        type="submit"
        disabled={pending}
        aria-label={tip}
        className="inline-flex items-center gap-1.5 rounded-md bg-success px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-success-strong disabled:opacity-60"
      >
        {justSaved ? Icons.check : Icons.save}
        {pending ? "Saving…" : justSaved ? "Saved" : label}
      </button>
    </WithTip>
  );
}

// Back-compat alias used by earlier pages.
export function SubmitButton({
  label,
  variant = "primary",
}: {
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "danger" | "outline";
}) {
  const icon: IconName = variant === "danger" ? "trash" : "check";
  return <ActionButton icon={icon} tip={label} label={label} variant={variant} />;
}
