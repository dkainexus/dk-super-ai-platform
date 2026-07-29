import { redirect } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import { activeCountry } from "@/modules/merchants/lib";
import { bankAccountPage, bankAccountCounts } from "@/modules/bank-accounts/lib";
import { BankAccountsList } from "@/modules/bank-accounts/components/accounts-list";
import { pageParams } from "@/components/pagination";

export default async function MerchantBankAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string; bank?: string; page?: string; per?: string }>;
}) {
  const { cu } = await requirePerm("bank_accounts", "view");
  if (!cu.merchant) redirect("/admin/bank-accounts");
  const { active } = await activeCountry(cu);
  const toggles = await globalModuleToggles();
  if (!moduleEnabledFor("bank_accounts", toggles, cu.merchant, active)) redirect("/m");

  const sp = await searchParams;
  const { error, status = "", bank = "" } = sp;
  const { page, perPage, from, to } = pageParams(sp);

  let bq = db().from("banks").select("id, name, code").eq("active", true).order("sort");
  if (active) bq = bq.eq("country_id", active.id);

  const [{ rows, total }, counts, { data: banks }] = await Promise.all([
    bankAccountPage({ merchantId: cu.merchant.id, countryId: active?.id, status, bankId: bank, from, to }),
    bankAccountCounts({ merchantId: cu.merchant.id, countryId: active?.id }),
    bq,
  ]);

  return (
    <BankAccountsList
      base="/m/bank-accounts"
      error={error}
      status={status}
      bank={bank}
      banks={(banks ?? []) as { id: string; name: string; code: string | null }[]}
      rows={rows}
      total={total}
      counts={counts}
      page={page}
      perPage={perPage}
      canAdd={Boolean(can(cu, "bank_accounts", "add"))}
    />
  );
}
