import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import { CompanyStatusTag } from "@/components/status-tag";
import { COMPANY_STATUS_LABEL, type Company, type CompanyStatus } from "@/lib/types";

export default async function MerchantCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { cu, scope } = await requirePerm("companies", "view");
  if (!cu.merchant) redirect("/admin/companies");
  const toggles = await globalModuleToggles();
  if (!moduleEnabledFor("companies", toggles, cu.merchant)) redirect("/m");
  const { status = "" } = await searchParams;

  let q = db()
    .from("companies")
    .select("*, members:company_members(role, owner:owners(full_name))")
    .eq("merchant_id", cu.merchant.id)
    .order("created_at", { ascending: false });
  if (scope === "own") q = q.eq("created_by", cu.user.id);
  if (status) q = q.eq("status", status);
  const { data: companies } = await q;

  type Row = Company & { members: { role: string; owner: { full_name: string | null } | null }[] };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Companies</h1>
        {can(cu, "companies", "add") && (
          <Link href="/m/companies/new" className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background hover:bg-accent-strong">
            + New Company
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[["", "All"], ...Object.entries(COMPANY_STATUS_LABEL)].map(([value, label]) => (
          <Link
            key={value}
            href={`/m/companies${value ? `?status=${value}` : ""}`}
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

      <div className="card divide-y divide-border">
        {(companies ?? []).length === 0 && <p className="px-5 py-6 text-sm text-muted">No companies yet.</p>}
        {((companies ?? []) as Row[]).map((c) => {
          const boundOwner = c.members?.find((m) => m.role === "owner")?.owner?.full_name;
          return (
            <Link key={c.id} href={`/m/companies/${c.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-surface-raised">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {c.name}
                  {c.company_id && <span className="mono-num ml-2 text-xs text-muted">{c.company_id}</span>}
                </p>
                <p className="truncate text-xs text-muted">
                  Owner: {boundOwner ?? "—"}
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
