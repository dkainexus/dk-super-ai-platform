import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { adminSaveOwner } from "@/app/actions/cms";
import { banksForCountry } from "@/lib/banks";
import { ErrorBanner } from "@/components/error-banner";
import { OwnerForm } from "@/components/owner-form";
import type { Country, CountryField, Merchant } from "@/lib/types";

// Platform-side owner creation: pick the merchant first (it decides the
// country and therefore the custom fields), then fill the form.
export default async function AdminNewOwnerPage({
  searchParams,
}: {
  searchParams: Promise<{ merchant?: string; error?: string }>;
}) {
  await requirePerm("owners", "add");
  const { merchant: merchantId = "", error } = await searchParams;

  const { data: merchants } = await db()
    .from("merchants")
    .select("*, country:countries(*)")
    .eq("status", "active")
    .order("name");
  const list = (merchants ?? []) as (Merchant & { country: Country })[];
  const selected = list.find((m) => m.id === merchantId) ?? null;

  const { data: fields } = selected
    ? await db()
        .from("country_fields")
        .select("*")
        .eq("country_id", selected.country_id)
        .eq("active", true)
        .order("sort")
    : { data: [] };
  const banks = selected ? await banksForCountry(selected.country_id, null) : [];

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
        <h2 className="mb-3 text-sm font-semibold">1. Choose Merchant</h2>
        <form method="get" className="flex max-w-md items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">
              The merchant decides the country and its custom fields
            </label>
            <select name="merchant" defaultValue={merchantId} className="input">
              <option value="">— Select a merchant —</option>
              {list.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.country?.flag} {m.name} ({m.country?.name})
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary">
            Continue
          </button>
        </form>
      </section>

      {selected && (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold">
            2. Owner Details — {selected.country?.flag} {selected.name}
          </h2>
          <OwnerForm
            fields={(fields ?? []) as CountryField[]}
            banks={banks}
            action={adminSaveOwner}
            hidden={{ merchant_id: selected.id }}
          />
        </section>
      )}
    </div>
  );
}
