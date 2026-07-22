import Link from "next/link";
import { requireMerchantUser, requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { banksForCountry } from "@/modules/banks/lib";
import { occupationsList } from "@/modules/owners/lib";
import { merchantCountries } from "@/modules/merchants/lib";
import { ErrorBanner } from "@/components/error-banner";
import { OwnerForm } from "@/modules/owners/components/owner-form";
import type { CountryField } from "@/lib/types";

// Country is always chosen first — auto-selected when the white label only
// operates in one country.
export default async function NewOwnerPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; error?: string }>;
}) {
  const cu = await requireMerchantUser();
  await requirePerm("owners", "add");
  const merchant = cu.merchant;
  const { country: countryParam = "", error } = await searchParams;

  const countries = await merchantCountries(merchant.id);
  const country = countries.find((c) => c.id === countryParam) ?? (countries.length === 1 ? countries[0] : null);

  const [{ data: fields }, banks, occupations] = country
    ? await Promise.all([
        db().from("country_fields").select("*").eq("country_id", country.id).eq("active", true).order("sort"),
        banksForCountry(country.id, merchant),
        occupationsList(),
      ])
    : [{ data: [] }, [], []];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/m/owners" className="text-xs text-muted hover:text-foreground">
          ← Owners
        </Link>
        <h1 className="mt-1 text-xl font-semibold">New Owner</h1>
      </div>
      <ErrorBanner message={error} />

      {countries.length > 1 && (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold">1. Choose Country</h2>
          <div className="flex flex-wrap gap-2">
            {countries.map((c) => (
              <Link
                key={c.id}
                href={`/m/owners/new?country=${c.id}`}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  country?.id === c.id
                    ? "border-accent bg-accent-soft text-accent-strong"
                    : "border-border text-muted hover:border-accent hover:text-foreground"
                }`}
              >
                {c.flag || "🌐"} {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {countries.length === 0 && (
        <p className="card px-5 py-6 text-sm text-muted">
          No countries enabled for your white label yet — contact the platform administrator.
        </p>
      )}

      {country && (
        <div className="card p-5">
          {countries.length > 1 && (
            <h2 className="mb-3 text-sm font-semibold">
              2. Owner Details — {country.flag || "🌐"} {country.name}
            </h2>
          )}
          <OwnerForm
            fields={(fields ?? []) as CountryField[]}
            banks={banks}
            occupations={occupations}
            hidden={{ country_id: country.id }}
          />
        </div>
      )}
    </div>
  );
}
