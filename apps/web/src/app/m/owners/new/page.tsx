import Link from "next/link";
import { requireMerchantUser, requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { banksForCountry } from "@/lib/banks";
import { ErrorBanner } from "@/components/error-banner";
import { OwnerForm } from "@/components/owner-form";
import type { CountryField } from "@/lib/types";

export default async function NewOwnerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cu = await requireMerchantUser();
  await requirePerm("owners", "add");
  const merchant = cu.merchant;
  const { error } = await searchParams;

  const [{ data: fields }, banks] = await Promise.all([
    db()
      .from("country_fields")
      .select("*")
      .eq("country_id", merchant.country_id)
      .eq("active", true)
      .order("sort"),
    banksForCountry(merchant.country_id, merchant),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/m/owners" className="text-xs text-muted hover:text-foreground">
          ← Owners
        </Link>
        <h1 className="mt-1 text-xl font-semibold">New Owner</h1>
      </div>
      <ErrorBanner message={error} />
      <div className="card p-5">
        <OwnerForm fields={(fields ?? []) as CountryField[]} banks={banks} />
      </div>
    </div>
  );
}
