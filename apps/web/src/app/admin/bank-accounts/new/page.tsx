import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { BankAccountForm, type FormBank, type FormCompany } from "@/modules/bank-accounts/components/account-form";
import { ErrorBanner } from "@/components/error-banner";
import { requireCountryScope } from "@/modules/countries/lib";

export default async function NewBankAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePerm("bank_accounts", "add");
  const { error } = await searchParams;
  const { active } = await requireCountryScope();

  let companyQuery = db()
    .from("companies")
    .select("id, name, country_id, merchant_id, merchant:merchants(name)")
    .neq("status", "banned")
    .order("name");
  let bankQuery = db().from("banks").select("id, name, code, country_id, account_fields, channels").eq("active", true).order("sort");
  if (active) {
    companyQuery = companyQuery.eq("country_id", active.id);
    bankQuery = bankQuery.eq("country_id", active.id);
  }

  const [{ data: companies }, { data: banks }, { data: countries }] = await Promise.all([
    companyQuery,
    bankQuery,
    db().from("countries").select("id, code"),
  ]);
  const countryCodes = Object.fromEntries(
    ((countries ?? []) as { id: string; code: string }[]).map((c) => [c.id, c.code])
  );
  const formCompanies: FormCompany[] = ((companies ?? []) as unknown as {
    id: string; name: string; country_id: string | null; merchant_id: string; merchant: { name: string } | null;
  }[]).map((c) => ({
    id: c.id,
    name: c.name,
    country_id: c.country_id,
    merchant_id: c.merchant_id,
    merchant_name: c.merchant?.name,
  }));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/bank-accounts" className="text-xs text-muted hover:text-foreground">← Bank Accounts</Link>
        <h1 className="mt-1 text-xl font-semibold">New Bank Account</h1>
        <p className="mt-1 text-sm text-muted">
          Pick the company first — banks, branches and extra fields follow the company&apos;s country. Accounts
          added here are active straight away.
        </p>
      </div>
      <ErrorBanner message={error} />

      <section className="card p-5">
        <BankAccountForm
          companies={formCompanies}
          banks={(banks ?? []) as FormBank[]}
          countryCodes={countryCodes}
          channels={(active?.payment_channels ?? []) as string[]}
        />
      </section>
    </div>
  );
}
