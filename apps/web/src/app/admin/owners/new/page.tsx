import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { adminSaveOwner } from "@/modules/owners/actions";
import { banksForCountry } from "@/modules/banks/lib";
import { occupationsList } from "@/modules/owners/lib";
import { merchantCountries } from "@/modules/merchants/lib";
import { ErrorBanner } from "@/components/error-banner";
import { OwnerForm } from "@/modules/owners/components/owner-form";
import type { CountryField, Merchant } from "@/lib/types";

// Platform-side owner creation: pick the white label, then the country
// (from that white label's enabled countries), then fill the form.
export default async function AdminNewOwnerPage({
  searchParams,
}: {
  searchParams: Promise<{ merchant?: string; country?: string; error?: string }>;
}) {
  await requirePerm("owners", "add");
  const { merchant: merchantId = "", country: countryParam = "", error } = await searchParams;

  const { data: merchants } = await db().from("merchants").select("*").eq("status", "active").order("name");
  const list = (merchants ?? []) as Merchant[];
  const selected = list.find((m) => m.id === merchantId) ?? null;

  const countries = selected ? await merchantCountries(selected.id) : [];
  const country = countries.find((c) => c.id === countryParam) ?? (countries.length === 1 ? countries[0] : null);

  const { data: fields } = country
    ? await db().from("country_fields").select("*").eq("country_id", country.id).eq("active", true).order("sort")
    : { data: [] };
  const banks = country ? await banksForCountry(country.id, null) : [];
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

      {selected && (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold">2. Choose Country</h2>
          <div className="flex flex-wrap gap-2">
            {countries.map((c) => (
              <Link
                key={c.id}
                href={`/admin/owners/new?merchant=${selected.id}&country=${c.id}`}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  country?.id === c.id
                    ? "border-accent bg-accent-soft text-accent-strong"
                    : "border-border text-muted hover:border-accent hover:text-foreground"
                }`}
              >
                {c.flag || "🌐"} {c.name}
              </Link>
            ))}
            {countries.length === 0 && (
              <p className="text-sm text-muted">This white label has no countries enabled yet.</p>
            )}
          </div>
        </section>
      )}

      {selected && country && (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold">
            3. Owner Details — {selected.name} · {country.flag || "🌐"} {country.name}
          </h2>
          <OwnerForm
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
