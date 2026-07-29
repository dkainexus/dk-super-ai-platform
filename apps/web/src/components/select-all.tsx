"use client";

import { useRef } from "react";

// Header checkbox that ticks every row checkbox of the given name in its form.
export function SelectAll({ name = "ids", tip = "Select all" }: { name?: string; tip?: string }) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <input
      ref={ref}
      type="checkbox"
      title={tip}
      aria-label={tip}
      className="h-4 w-4 accent-[var(--accent)]"
      onChange={(e) => {
        const form = ref.current?.form;
        if (!form) return;
        form
          .querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${name}"]:not(:disabled)`)
          .forEach((box) => {
            box.checked = e.target.checked;
          });
      }}
    />
  );
}
