import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { adminSaveOwner } from "@/app/actions/cms";
import { banksForCountry, occupationsList } from "@/lib/banks";
import { ErrorBanner } from "@/components/error-banner";
import { OwnerStatusTag } from "@/components/status-tag";
import { OwnerForm } from "@/components/owner-form";
import type { CountryField, Merchant, Owner, OwnerFieldValue } from "@/lib/types";

export default async function AdminOwnerEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePerm("owners", "edit");
  const { id } = await params;
  const { error } = await searchParams;

  const { data } = await db().from("owners").select("*, merchant:merchants(*)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const owner = data as Owner & { merchant: Merchant };

  const [{ data: fields }, { data: values }, banks, occupations] = await Promise.all([
    db().from("country_fields").select("*").eq("country_id", owner.country_id).eq("active", true).order("sort"),
    db().from("owner_field_values").select("*").eq("owner_id", owner.id),
    banksForCountry(owner.country_id, null),
    occupationsList(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/owners/${owner.id}`} className="text-xs text-muted hover:text-foreground">
          ← Owner Details
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">Edit: {owner.full_name || "(no name yet)"}</h1>
          <OwnerStatusTag status={owner.status} />
        </div>
        <p className="mt-1 text-sm text-muted">Merchant: {owner.merchant?.name}</p>
      </div>
      <ErrorBanner message={error} />

      <div className="card p-5">
        <OwnerForm
          fields={(fields ?? []) as CountryField[]}
          banks={banks}
          occupations={occupations}
          owner={owner}
          values={(values ?? []) as OwnerFieldValue[]}
          action={adminSaveOwner}
          locked={false}
        />
      </div>
    </div>
  );
}
