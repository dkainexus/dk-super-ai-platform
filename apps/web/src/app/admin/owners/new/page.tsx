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

// Platform-side owner creation. The country is the one you are working in and
// the white label is a field on the form itself.
export default async function AdminNewOwnerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePerm("owners", "add");
  const { error } = await searchParams;
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
        {country && (
          <p className="mt-1 text-sm text-muted">
            Registered in {country.flag || "🌐"} {country.name}.
          </p>
        )}
      </div>
      <ErrorBanner message={error} />

      {country && (
        <section className="card p-5">
          <OwnerForm
            provinces={provinces}
            agents={agentOptions}
            merchants={list.map((m) => ({ id: m.id, name: m.name }))}
            fields={(fields ?? []) as CountryField[]}
            banks={banks}
            occupations={occupations}
            action={adminSaveOwner}
            hidden={{ country_id: country.id }}
          />
        </section>
      )}
    </div>
  );
}
