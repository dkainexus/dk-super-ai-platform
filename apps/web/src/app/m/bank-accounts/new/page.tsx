import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { activeCountry } from "@/modules/merchants/lib";
import { BankAccountForm, type FormBank, type FormCompany } from "@/modules/bank-accounts/components/account-form";
import { ErrorBanner } from "@/components/error-banner";

export default async function MerchantNewBankAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("bank_accounts", "add");
  if (!cu.merchant) redirect("/admin/bank-accounts/new");
  const { active } = await activeCountry(cu);
  const { error } = await searchParams;

  let cq = db()
    .from("companies")
    .select("id, name, country_id, merchant_id")
    .eq("merchant_id", cu.merchant.id)
    .neq("status", "banned")
    .order("name");
  if (active) cq = cq.eq("country_id", active.id);
  let bq = db().from("banks").select("id, name, code, country_id, account_fields, channels").eq("active", true).order("sort");
  if (active) bq = bq.eq("country_id", active.id);

  const [{ data: companies }, { data: banks }, { data: countries }] = await Promise.all([
    cq,
    bq,
    db().from("countries").select("id, code"),
  ]);
  const countryCodes = Object.fromEntries(
    ((countries ?? []) as { id: string; code: string }[]).map((c) => [c.id, c.code])
  );

  return (
    <div className="space-y-5">
      <div>
        <Link href="/m/bank-accounts" className="text-xs text-muted hover:text-foreground">← Bank Accounts</Link>
        <h1 className="mt-1 text-xl font-semibold">New Bank Account</h1>
        <p className="mt-1 text-sm text-muted">
          Pick the company first — banks, branches and extra fields follow the company&apos;s country.
        </p>
      </div>
      <ErrorBanner message={error} />

      <section className="card p-5">
        <BankAccountForm
          companies={(companies ?? []) as FormCompany[]}
          banks={(banks ?? []) as FormBank[]}
          countryCodes={countryCodes}
          channels={(active?.payment_channels ?? []) as string[]}
        />
      </section>
    </div>
  );
}
