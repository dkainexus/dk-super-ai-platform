"use client";

// Filter bar for list views: any select inside submits the form on change,
// so filtering is one click with no Apply button.

import { useRef } from "react";

export function FilterForm({ action, children }: { action: string; children: React.ReactNode }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={action}
      method="get"
      onChange={() => ref.current?.requestSubmit()}
      className="flex flex-wrap items-end gap-3"
    >
      {children}
    </form>
  );
}

/**
 * Free-text search inside a FilterForm: typing must NOT auto-submit like the
 * selects do, so change events stop here — Enter submits the form.
 */
export function SearchInput({
  placeholder = "Search…",
  defaultValue = "",
  name = "q",
}: {
  placeholder?: string;
  defaultValue?: string;
  name?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Search</label>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => e.stopPropagation()}
        className="input w-52 py-1.5 text-sm"
      />
    </div>
  );
}
