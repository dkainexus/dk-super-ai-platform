// Shared list-view chrome: a header row with the record count and filter
// dropdowns, plus a table that scrolls sideways on small screens.

import Link from "next/link";

export function TableToolbar({
  count,
  noun,
  children,
}: {
  count: number;
  /** Singular noun, pluralised with a trailing "s" */
  noun: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <p className="text-sm text-muted">
        <span className="mono-num text-base font-semibold text-foreground">{count.toLocaleString()}</span>{" "}
        {count === 1 ? noun : `${noun}s`}
      </p>
      <div className="flex flex-wrap items-end gap-3">{children}</div>
    </div>
  );
}

/** A GET filter that submits on change — no Apply button. */
export function FilterSelect({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">{label}</label>
      <select name={name} defaultValue={value} className="input w-44 py-1.5 text-xs" data-autosubmit>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden overflow-x-auto p-0">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-accent-strong hover:underline">
      {children}
    </Link>
  );
}
