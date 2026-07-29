import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { bankAccountPage, bankAccountCounts } from "@/modules/bank-accounts/lib";
import { BankAccountsList } from "@/modules/bank-accounts/components/accounts-list";
import { pageParams } from "@/components/pagination";
import { requireCountryScope } from "@/modules/countries/lib";

export default async function AdminBankAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string; bank?: string; page?: string; per?: string }>;
}) {
  const { cu } = await requirePerm("bank_accounts", "view");
  const sp = await searchParams;
  const { error, status = "", bank = "" } = sp;
  const { page, perPage, from, to } = pageParams(sp);
  const { active } = await requireCountryScope();

  let bankQuery = db().from("banks").select("id, name, code").eq("active", true).order("sort");
  if (active) bankQuery = bankQuery.eq("country_id", active.id);

  const [{ rows, total }, counts, { data: banks }] = await Promise.all([
    bankAccountPage({ countryId: active?.id, status, bankId: bank, from, to }),
    bankAccountCounts({ countryId: active?.id }),
    bankQuery,
  ]);

  return (
    <BankAccountsList
      base="/admin/bank-accounts"
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
