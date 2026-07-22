"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

const SaveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <path d="M17 21v-8H7v8M7 3v5h8" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

// Green Save button for <form action={serverAction}>: pending state while the
// action runs, brief "Saved" confirmation after.
export function SaveButton({
  label = "保存",
  savingLabel = "保存中…",
  savedLabel = "已保存",
  title,
}: {
  label?: string;
  savingLabel?: string;
  savedLabel?: string;
  title?: string;
}) {
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
    <button
      type="submit"
      disabled={pending}
      title={title ?? label}
      className="inline-flex items-center gap-1.5 rounded-md bg-success px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-success-strong disabled:opacity-60"
    >
      {justSaved ? <CheckIcon /> : <SaveIcon />}
      {pending ? savingLabel : justSaved ? savedLabel : label}
    </button>
  );
}

// Generic submit button with pending state.
export function SubmitButton({
  label,
  pendingLabel,
  variant = "primary",
}: {
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "danger" | "outline";
}) {
  const { pending } = useFormStatus();
  const cls =
    variant === "primary"
      ? "bg-accent text-background hover:bg-accent-strong"
      : variant === "danger"
        ? "bg-danger text-white hover:opacity-90"
        : "border border-border text-foreground hover:border-accent";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${cls}`}
    >
      {pending ? (pendingLabel ?? label + "…") : label}
    </button>
  );
}
