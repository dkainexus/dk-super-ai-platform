import Link from "next/link";
import { requireMerchant } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { ErrorBanner } from "@/components/error-banner";
import { OwnerForm } from "@/components/owner-form";
import type { CountryField } from "@/lib/types";

export default async function NewOwnerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { merchant } = await requireMerchant();
  const { error } = await searchParams;

  const { data: fields } = await db()
    .from("country_fields")
    .select("*")
    .eq("country_id", merchant.country_id)
    .eq("active", true)
    .order("sort");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/m/owners" className="text-xs text-muted hover:text-foreground">
          ← Owner 管理
        </Link>
        <h1 className="mt-1 text-xl font-semibold">新增 Owner</h1>
      </div>
      <ErrorBanner message={error} />
      <div className="card p-5">
        <OwnerForm fields={(fields ?? []) as CountryField[]} />
      </div>
    </div>
  );
}
