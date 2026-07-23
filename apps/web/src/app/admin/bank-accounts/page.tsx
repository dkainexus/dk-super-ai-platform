import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { bankAccounts } from "@/modules/bank-accounts/lib";
import { BankAccountsView } from "@/modules/bank-accounts/components/accounts-view";
import type { FormBank, FormCompany } from "@/modules/bank-accounts/components/account-form";

export default async function AdminBankAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const { cu } = await requirePerm("bank_accounts", "view");
  const { error, status = "" } = await searchParams;

  const [rows, { data: companies }, { data: banks }] = await Promise.all([
    bankAccounts({}),
    db().from("companies").select("id, name, country_id, merchant:merchants(name)").neq("status", "banned").order("name"),
    db().from("banks").select("id, name, country_id, account_fields, channels").eq("active", true).order("sort"),
  ]);

  const formCompanies: FormCompany[] = ((companies ?? []) as unknown as {
    id: string; name: string; country_id: string | null; merchant: { name: string } | null;
  }[]).map((c) => ({ id: c.id, name: c.name, country_id: c.country_id, merchant_name: c.merchant?.name }));

  return (
    <BankAccountsView
      base="/admin/bank-accounts"
      error={error}
      status={status}
      rows={rows}
      canAdd={Boolean(can(cu, "bank_accounts", "add"))}
      canEdit={Boolean(can(cu, "bank_accounts", "edit"))}
      canDelete={Boolean(can(cu, "bank_accounts", "delete"))}
      companies={formCompanies}
      banks={(banks ?? []) as FormBank[]}
    />
  );
}
