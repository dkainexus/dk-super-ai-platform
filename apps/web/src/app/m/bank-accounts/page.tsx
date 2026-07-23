import { redirect } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import { activeCountry } from "@/modules/merchants/lib";
import { bankAccounts } from "@/modules/bank-accounts/lib";
import { BankAccountsView } from "@/modules/bank-accounts/components/accounts-view";
import type { FormBank, FormCompany } from "@/modules/bank-accounts/components/account-form";

export default async function MerchantBankAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const { cu } = await requirePerm("bank_accounts", "view");
  if (!cu.merchant) redirect("/admin/bank-accounts");
  const { active } = await activeCountry(cu);
  const toggles = await globalModuleToggles();
  if (!moduleEnabledFor("bank_accounts", toggles, cu.merchant, active)) redirect("/m");
  const { error, status = "" } = await searchParams;

  let cq = db()
    .from("companies")
    .select("id, name, country_id")
    .eq("merchant_id", cu.merchant.id)
    .neq("status", "banned")
    .order("name");
  if (active) cq = cq.eq("country_id", active.id);
  const [rows, { data: companies }, { data: banks }] = await Promise.all([
    bankAccounts({ merchantId: cu.merchant.id, countryId: active?.id }),
    cq,
    active
      ? db().from("banks").select("id, name, country_id, account_fields, channels").eq("active", true).eq("country_id", active.id).order("sort")
      : db().from("banks").select("id, name, country_id, account_fields, channels").eq("active", true).order("sort"),
  ]);

  return (
    <BankAccountsView
      base="/m/bank-accounts"
      error={error}
      status={status}
      rows={rows}
      canAdd={Boolean(can(cu, "bank_accounts", "add"))}
      canEdit={Boolean(can(cu, "bank_accounts", "edit"))}
      canDelete={Boolean(can(cu, "bank_accounts", "delete"))}
      companies={(companies ?? []) as FormCompany[]}
      banks={(banks ?? []) as FormBank[]}
    />
  );
}
