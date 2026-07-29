import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { WithdrawalsQueue } from "@/modules/wallet/components/withdrawals-queue";
import { ErrorBanner } from "@/components/error-banner";
import type { Owner, Withdrawal } from "@/lib/types";
import { requireCountryScope } from "@/modules/countries/lib";

// Platform wallet center: withdrawal queue (the money you owe people) on
// top, balances + manual credit below.
export default async function WithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string; merchant?: string }>;
}) {
  const { cu } = await requirePerm("wallet", "view");
  const { error, status = "", merchant = "" } = await searchParams;
  const canEdit = Boolean(can(cu, "wallet", "edit"));

  let wq = db().from("withdrawals").select("*").order("requested_at", { ascending: false }).limit(100);
  if (status) wq = wq.eq("status", status);
  const { active } = await requireCountryScope();
  let ownerQuery = db()
    .from("owners")
    .select("id, full_name, merchant_id, country_id, status, merchant:merchants(name), country:countries(flag, name)");
  if (active) ownerQuery = ownerQuery.eq("country_id", active.id);
  if (merchant) ownerQuery = ownerQuery.eq("merchant_id", merchant);

  const [{ data: withdrawals }, { data: owners }] = await Promise.all([
    wq,
    ownerQuery,
  ]);

  const ownerById = new Map(
    ((owners ?? []) as unknown as (Owner & { merchant: { name: string } | null })[]).map((o) => [o.id, o])
  );
  const ownerNames = new Map(
    ((owners ?? []) as unknown as Owner[]).map((o) => [o.id, o.full_name ?? "(no name)"])
  );
  const pendingCount = ((withdrawals ?? []) as Withdrawal[]).filter((w) => w.status === "pending").length;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/wallets" className="text-xs text-muted hover:text-foreground">← Wallets</Link>
        <h1 className="mt-1 text-xl font-semibold">Withdrawals</h1>
        <p className="mt-1 text-sm text-muted">
          Owner wallets and withdrawal processing. Transfer manually, then mark the request paid.
        </p>
      </div>
      <ErrorBanner message={error} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Withdrawals{pendingCount > 0 ? ` — ${pendingCount} pending` : ""}
          </h2>
          <div className="ml-auto flex gap-2">
            {[["", "All"], ["pending", "Pending"], ["paid", "Paid"], ["rejected", "Rejected"]].map(([v, label]) => (
              <a
                key={v}
                href={`/admin/wallets${v ? `?status=${v}` : ""}`}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  status === v
                    ? "border-accent bg-accent-soft text-accent-strong"
                    : "border-border text-muted hover:border-accent hover:text-foreground"
                }`}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
        <WithdrawalsQueue
          withdrawals={(withdrawals ?? []) as Withdrawal[]}
          ownerNames={ownerNames}
          canProcess={canEdit}
          back="/admin/wallets"
        />
      </section>

    </div>
  );
}
