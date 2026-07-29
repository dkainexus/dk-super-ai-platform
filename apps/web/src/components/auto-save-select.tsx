"use client";

// A dropdown that saves the moment you change it — no Save button.

import { useRef } from "react";

export function AutoSaveSelect({
  action,
  name,
  value,
  options,
  hidden,
  className,
}: {
  action: (formData: FormData) => Promise<void>;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  hidden?: Record<string, string>;
  className?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={action}>
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <select
        name={name}
        defaultValue={value}
        onChange={() => ref.current?.requestSubmit()}
        className={className ?? "input w-48 py-1.5 text-sm"}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </form>
  );
}
