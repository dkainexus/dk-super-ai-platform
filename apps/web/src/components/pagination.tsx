import Link from "next/link";

export const PAGE_SIZES = [25, 50, 100, 200];

/** Standard list footer: rows-per-page plus prev/next. */
export function Pagination({
  basePath,
  params,
  page,
  perPage,
  total,
}: {
  basePath: string;
  /** Current filters, carried across page changes */
  params: Record<string, string>;
  page: number;
  perPage: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const href = (over: Record<string, string | number>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...over })) {
      if (v !== "" && v != null) p.set(k, String(v));
    }
    const q = p.toString();
    return q ? `${basePath}?${q}` : basePath;
  };

  const step = (label: string, target: number, disabled: boolean) =>
    disabled ? (
      <span className="rounded-md border border-border px-3 py-1 text-xs text-muted opacity-40">{label}</span>
    ) : (
      <Link
        href={href({ page: target })}
        className="rounded-md border border-border px-3 py-1 text-xs transition-colors hover:border-accent"
      >
        {label}
      </Link>
    );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
      <div className="flex items-center gap-2">
        <span>Rows per page</span>
        {PAGE_SIZES.map((n) => (
          <Link
            key={n}
            href={href({ per: n, page: 1 })}
            className={`rounded-md border px-2 py-0.5 transition-colors ${
              perPage === n ? "border-accent bg-accent-soft text-accent-strong" : "border-border hover:border-accent"
            }`}
          >
            {n}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="mono-num">
          {from}–{to} of {total.toLocaleString()}
        </span>
        {step("← Prev", page - 1, page <= 1)}
        <span className="mono-num">
          {page} / {pages}
        </span>
        {step("Next →", page + 1, page >= pages)}
      </div>
    </div>
  );
}

/** Parse ?page= and ?per= into safe numbers. */
export function pageParams(sp: { page?: string; per?: string }): { page: number; perPage: number; from: number; to: number } {
  const perPage = PAGE_SIZES.includes(Number(sp.per)) ? Number(sp.per) : 25;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * perPage;
  return { page, perPage, from, to: from + perPage - 1 };
}
