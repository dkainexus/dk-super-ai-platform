import Link from "next/link";
import { requireMerchantUser, requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { banksForCountry } from "@/modules/banks/lib";
import { occupationsList } from "@/modules/owners/lib";
import { activeCountry } from "@/modules/merchants/lib";
import { ErrorBanner } from "@/components/error-banner";
import { OwnerForm } from "@/modules/owners/components/owner-form";
import type { CountryField } from "@/lib/types";

// Country is always chosen first — auto-selected when the white label only
// operates in one country.
export default async function NewOwnerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cu = await requireMerchantUser();
  await requirePerm("owners", "add");
  const merchant = cu.merchant;
  const { error } = await searchParams;

  // The portal's active country (top-bar switcher) decides the country.
  const { active: country, allowed } = await activeCountry(cu);

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

      {allowed.length === 0 && (
        <p className="card px-5 py-6 text-sm text-muted">
          No countries enabled for your account yet — contact your administrator.
        </p>
      )}

      {country && (
        <div className="card p-5">
          {allowed.length > 1 && (
            <p className="mb-3 text-xs text-muted">
              Creating in {country.flag || "🌐"} {country.name} — switch country from the top bar.
            </p>
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
