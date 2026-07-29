import { notFound } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { bankAccount } from "@/modules/bank-accounts/lib";
import { BankAccountDetail } from "@/modules/bank-accounts/components/account-detail";

export default async function AdminBankAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("bank_accounts", "view");
  const { id } = await params;
  const { error } = await searchParams;
  const a = await bankAccount(id);
  if (!a) notFound();

  const { data: countries } = await db().from("countries").select("id, code, payment_channels");
  const list = (countries ?? []) as { id: string; code: string; payment_channels: string[] | null }[];
  const countryCodes = Object.fromEntries(list.map((c) => [c.id, c.code]));
  const channels = list.find((c) => c.id === a.country_id)?.payment_channels ?? [];

  return (
    <BankAccountDetail
      a={a}
      base="/admin/bank-accounts"
      canEdit={Boolean(can(cu, "bank_accounts", "edit"))}
      canDelete={Boolean(can(cu, "bank_accounts", "delete"))}
      countryCodes={countryCodes}
      channels={channels}
      error={error}
    />
  );
}
