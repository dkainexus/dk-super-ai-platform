"use client";

// A text field that saves when you leave it or press Enter, and says so.

import { useRef, useState, useTransition } from "react";

export function AutoSaveInput({
  action,
  name,
  value,
  hidden,
  className,
}: {
  action: (formData: FormData) => Promise<void>;
  name: string;
  value: string;
  hidden?: Record<string, string>;
  className?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(next: string) {
    if (next.trim() === value.trim() || !next.trim()) return;
    startTransition(() => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(hidden ?? {})) fd.set(k, v);
      fd.set(name, next);
      action(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <form ref={ref} className="flex min-w-48 flex-1 items-center gap-2">
      <input
        name={name}
        defaultValue={value}
        onBlur={(e) => save(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={className ?? "input py-1.5 text-sm"}
      />
      <span className={`text-[11px] transition-opacity ${pending || saved ? "opacity-100" : "opacity-0"} ${saved ? "text-success" : "text-muted"}`}>
        {pending ? "Saving…" : "Saved ✓"}
      </span>
    </form>
  );
}
