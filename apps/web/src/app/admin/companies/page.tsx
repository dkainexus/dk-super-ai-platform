import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { CompanyStatusTag } from "@/components/status-tag";
import { COMPANY_STATUS_LABEL, type Company, type CompanyStatus } from "@/lib/types";

// Platform-wide company list with filters on the structured columns.
export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; country?: string; merchant?: string; province?: string }>;
}) {
  const { cu } = await requirePerm("companies", "view");
  const { status = "", country = "", merchant = "", province = "" } = await searchParams;

  const [{ data: countries }, { data: merchants }] = await Promise.all([
    db().from("countries").select("id, name, flag").order("sort"),
    db().from("merchants").select("id, name").order("name"),
  ]);

  let q = db()
    .from("companies")
    .select("*, merchant:merchants(name), country:countries(name, flag), members:company_members(role, owner:owners(full_name))")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) q = q.eq("status", status);
  if (country) q = q.eq("country_id", country);
  if (merchant) q = q.eq("merchant_id", merchant);
  if (province) q = q.ilike("province", `%${province}%`);
  const { data: companies } = await q;

  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ status, country, merchant, province, ...over })) {
      if (v) p.set(k, v);
    }
    const str = p.toString();
    return str ? `?${str}` : "";
  };

  type Row = Company & {
    merchant: { name: string } | null;
    country: { name: string; flag: string | null } | null;
    members: { role: string; owner: { full_name: string | null } | null }[];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Companies</h1>
        {can(cu, "companies", "add") && (
          <Link href="/admin/companies/new" className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background hover:bg-accent-strong">
            + New Company
          </Link>
        )}
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap items-center gap-2">
        {[["", "All"], ...Object.entries(COMPANY_STATUS_LABEL)].map(([value, label]) => (
          <Link
            key={value}
            href={`/admin/companies${qs({ status: value })}`}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              status === value
                ? "border-accent bg-accent-soft text-accent-strong"
                : "border-border text-muted hover:border-accent hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Structured filters */}
      <form method="GET" className="flex flex-wrap items-end gap-3">
        {status && <input type="hidden" name="status" value={status} />}
        <div>
          <label className="mb-1 block text-xs text-muted">Country</label>
          <select name="country" defaultValue={country} className="input">
            <option value="">All</option>
            {(countries ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">White Label</label>
          <select name="merchant" defaultValue={merchant} className="input">
            <option value="">All</option>
            {(merchants ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Province</label>
          <input name="province" defaultValue={province} placeholder="e.g. Bangkok" className="input" />
        </div>
        <button type="submit" className="rounded-md border border-border px-3 py-2 text-sm hover:border-accent" title="Apply the filters">
          Filter
        </button>
        {(country || merchant || province) && (
          <Link href={`/admin/companies${qs({ country: "", merchant: "", province: "" })}`} className="pb-2 text-xs text-muted hover:text-foreground">
            Clear
          </Link>
        )}
      </form>

      <div className="card divide-y divide-border">
        {(companies ?? []).length === 0 && <p className="px-5 py-6 text-sm text-muted">No companies found.</p>}
        {((companies ?? []) as Row[]).map((c) => {
          const boundOwner = c.members?.find((m) => m.role === "owner")?.owner?.full_name;
          const shareholderCount = c.members?.filter((m) => m.role === "shareholder").length ?? 0;
          return (
            <Link key={c.id} href={`/admin/companies/${c.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-surface-raised">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {c.name}
                  {c.company_id && <span className="mono-num ml-2 text-xs text-muted">{c.company_id}</span>}
                </p>
                <p className="truncate text-xs text-muted">
                  {c.country?.flag} {c.merchant?.name} · Owner: {boundOwner ?? "—"}
                  {shareholderCount > 0 && ` · ${shareholderCount} shareholder(s)`}
                  {c.province && ` · ${c.province}`}
                </p>
              </div>
              <CompanyStatusTag status={c.status as CompanyStatus} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
