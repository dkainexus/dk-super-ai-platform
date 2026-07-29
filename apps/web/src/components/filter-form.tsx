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
