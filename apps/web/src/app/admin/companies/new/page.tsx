import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { bindableOwners, shareholdersEnabledFor } from "@/modules/companies/lib";
import { CompanyForm } from "@/modules/companies/components/company-form";
import { ErrorBanner } from "@/components/error-banner";
import type { Merchant, Occupation } from "@/lib/types";

// Two-step create: pick the white label first (it decides owners + country),
// then fill the company form. Same flow as /admin/owners/new.
export default async function AdminNewCompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ merchant?: string; error?: string }>;
}) {
  await requirePerm("companies", "add");
  const { merchant: merchantId = "", error } = await searchParams;

  const { data: merchants } = await db()
    .from("merchants")
    .select("*, country:countries(name, flag)")
    .eq("status", "active")
    .order("name");

  const selected = (merchants ?? []).find((m) => m.id === merchantId) as
    | (Merchant & { country: { name: string; flag: string | null } | null })
    | undefined;

  const [owners, shareholdersEnabled, { data: occupations }] = selected
    ? await Promise.all([
        bindableOwners(selected.id),
        shareholdersEnabledFor(selected.country_id),
        db().from("occupations").select("*"),
      ])
    : [[], false, { data: [] }];

  const occupationType = new Map(((occupations ?? []) as Occupation[]).map((o) => [o.id, o.company_type]));
  const typeByOwner = new Map(owners.map((o) => [o.id, o.occupation_id ? occupationType.get(o.occupation_id) ?? null : null]));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/companies" className="text-xs text-muted hover:text-foreground">
          ← Companies
        </Link>
        <h1 className="mt-1 text-xl font-semibold">New Company</h1>
      </div>
      <ErrorBanner message={error} />

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold">1. Choose White Label</h2>
        <div className="flex flex-wrap gap-2">
          {(merchants ?? []).map((m) => (
            <Link
              key={m.id}
              href={`/admin/companies/new?merchant=${m.id}`}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                merchantId === m.id
                  ? "border-accent bg-accent-soft text-accent-strong"
                  : "border-border text-muted hover:border-accent hover:text-foreground"
              }`}
            >
              {m.country?.flag} {m.name}
            </Link>
          ))}
          {(merchants ?? []).length === 0 && <p className="text-sm text-muted">No active white labels yet.</p>}
        </div>
      </section>

      {selected && (
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold">2. Company Details</h2>
          {owners.length === 0 ? (
            <p className="text-sm text-muted">
              This white label has no owners yet — a company must be bound to an owner.{" "}
              <Link href={`/admin/owners/new?merchant=${selected.id}`} className="text-accent-strong underline">
                Create an owner first →
              </Link>
            </p>
          ) : (
            <CompanyForm
              owners={owners}
              occupationTypeByOwner={typeByOwner}
              shareholdersEnabled={shareholdersEnabled}
              hidden={{ merchant_id: selected.id }}
            />
          )}
        </section>
      )}
    </div>
  );
}
