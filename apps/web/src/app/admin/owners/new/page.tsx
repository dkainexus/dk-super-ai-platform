import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { adminSaveOwner } from "@/modules/owners/actions";
import { banksForCountry } from "@/modules/banks/lib";
import { occupationsList } from "@/modules/owners/lib";
import { requireCountryScope } from "@/modules/countries/lib";
import { ErrorBanner } from "@/components/error-banner";
import { OwnerForm } from "@/modules/owners/components/owner-form";
import type { CountryField, Merchant } from "@/lib/types";

// Platform-side owner creation: pick the white label, then the country
// (from that white label's enabled countries), then fill the form.
export default async function AdminNewOwnerPage({
  searchParams,
}: {
  searchParams: Promise<{ merchant?: string; error?: string }>;
}) {
  await requirePerm("owners", "add");
  const { merchant: merchantId = "", error } = await searchParams;
  const { active } = await requireCountryScope();

  // Only white labels that operate in the country we are working in.
  const { data: links } = await db()
    .from("merchant_countries")
    .select("merchant:merchants(*)")
    .eq("country_id", active?.id ?? "");
  const list = ((links ?? []) as unknown as { merchant: Merchant | null }[])
    .map((l) => l.merchant)
    .filter((m): m is Merchant => Boolean(m) && m!.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name));
  const selected = list.find((m) => m.id === merchantId) ?? (list.length === 1 ? list[0] : null);
  const country = active;

  const { data: fields } = country
    ? await db().from("country_fields").select("*").eq("country_id", country.id).eq("active", true).order("sort")
    : { data: [] };
  const banks = country ? await banksForCountry(country.id, null) : [];
  const { data: provinceRows } = await db()
    .from("provinces")
    .select("name")
    .eq("country_id", country?.id ?? "")
    .eq("active", true)
    .order("sort");
  const provinces = ((provinceRows ?? []) as { name: string }[]).map((p) => p.name);
  const { data: agentRows } = await db()
    .from("agents")
    .select("id, full_name")
    .eq("status", "active")
    .order("full_name");
  const agentOptions = ((agentRows ?? []) as { id: string; full_name: string }[]).map((a) => ({
    id: a.id,
    name: a.full_name,
  }));
  const occupations = country ? await occupationsList() : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/owners" className="text-xs text-muted hover:text-foreground">
          ← Owners
        </Link>
        <h1 className="mt-1 text-xl font-semibold">New Owner</h1>
      </div>
      <ErrorBanner message={error} />

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold">1. Choose White Label</h2>
        <div className="flex flex-wrap gap-2">
          {list.map((m) => (
            <Link
              key={m.id}
              href={`/admin/owners/new?merchant=${m.id}`}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                merchantId === m.id
                  ? "border-accent bg-accent-soft text-accent-strong"
                  : "border-border text-muted hover:border-accent hover:text-foreground"
              }`}
            >
              {m.name}
            </Link>
          ))}
          {list.length === 0 && <p className="text-sm text-muted">No active white labels yet.</p>}
        </div>
      </section>

      {selected && country && (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold">
            2. Owner Details — {selected.name} · {country.name}
          </h2>
          <OwnerForm
            provinces={provinces}
            agents={agentOptions}
            fields={(fields ?? []) as CountryField[]}
            banks={banks}
            occupations={occupations}
            action={adminSaveOwner}
            hidden={{ merchant_id: selected.id, country_id: country.id }}
          />
        </section>
      )}
    </div>
  );
}
