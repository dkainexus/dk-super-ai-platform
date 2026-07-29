import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { bankAccounts } from "@/modules/bank-accounts/lib";
import { BankAccountsView } from "@/modules/bank-accounts/components/accounts-view";
import type { FormBank, FormCompany } from "@/modules/bank-accounts/components/account-form";
import { requireCountryScope } from "@/modules/countries/lib";

export default async function AdminBankAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const { cu } = await requirePerm("bank_accounts", "view");
  const { error, status = "" } = await searchParams;
  const { active } = await requireCountryScope();

  let companyQuery = db().from("companies").select("id, name, country_id, merchant:merchants(name)").neq("status", "banned").order("name");
  let bankQuery = db().from("banks").select("id, name, code, country_id, account_fields, channels").eq("active", true).order("sort");
  if (active) {
    companyQuery = companyQuery.eq("country_id", active.id);
    bankQuery = bankQuery.eq("country_id", active.id);
  }

  const [rows, { data: companies }, { data: banks }] = await Promise.all([
    bankAccounts({ countryId: active?.id }),
    companyQuery,
    bankQuery,
  ]);
  const { data: countries } = await db().from("countries").select("id, code");
  const countryCodes = Object.fromEntries(
    ((countries ?? []) as { id: string; code: string }[]).map((c) => [c.id, c.code])
  );

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
      countryCodes={countryCodes}
      channels={(active?.payment_channels ?? []) as string[]}
    />
  );
}
