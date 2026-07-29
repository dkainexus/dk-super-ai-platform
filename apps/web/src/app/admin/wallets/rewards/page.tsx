import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { manualCredit } from "@/modules/wallet/actions";
import { OwnerPicker } from "@/modules/wallet/components/owner-picker";
import { ledger } from "@/modules/wallet/lib";
import { requireCountryScope } from "@/modules/countries/lib";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { MoneyInput } from "@/components/money-input";
import { FilterSelect, Table, TableToolbar } from "@/components/data-table";
import { FilterForm } from "@/components/filter-form";
import { Pagination, pageParams } from "@/components/pagination";
import { fmtNum } from "@/lib/format";
import type { Owner } from "@/lib/types";

// Rewards: what each training video and exam pays, everything paid out so far,
// and a manual credit for anything that falls outside those rules.
export default async function WalletRewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; merchant?: string; page?: string; per?: string }>;
}) {
  const { cu } = await requirePerm("wallet", "view");
  const sp = await searchParams;
  const { error, merchant = "" } = sp;
  const { page, perPage, from, to } = pageParams(sp);
  const { active } = await requireCountryScope();

  let ownerQuery = db()
    .from("owners")
    .select("id, full_name, merchant_id, country_id, status, merchant:merchants(name), country:countries(flag, name)");
  if (active) ownerQuery = ownerQuery.eq("country_id", active.id);

  let videoQuery = db().from("training_videos").select("id, title, reward_amount, published").order("sort");
  let examQuery = db().from("exams").select("id, title, reward_amount, published").order("sort");
  if (active) {
    videoQuery = videoQuery.or(`country_id.is.null,country_id.eq.${active.id}`);
    examQuery = examQuery.or(`country_id.is.null,country_id.eq.${active.id}`);
  }

  const [{ data: owners }, { data: videos }, { data: exams }, paid] = await Promise.all([
    ownerQuery,
    videoQuery,
    examQuery,
    ledger({ countryId: active?.id ?? null, merchantId: merchant || null, type: "reward", from, to }),
  ]);

  const rules = [
    ...((videos ?? []) as { id: string; title: string; reward_amount: number | null; published: boolean }[]).map((v) => ({
      kind: "Training",
      href: "/admin/training",
      ...v,
    })),
    ...((exams ?? []) as { id: string; title: string; reward_amount: number | null; published: boolean }[]).map((e) => ({
      kind: "Exam",
      href: "/admin/exams",
      ...e,
    })),
  ].filter((r) => Number(r.reward_amount) > 0);

  const canAdd = can(cu, "wallet", "add");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/wallets" className="text-xs text-muted hover:text-foreground">← Wallets</Link>
        <h1 className="mt-1 text-xl font-semibold">Rewards</h1>
        <p className="mt-1 text-sm text-muted">
          Rewards are set on each training video and exam; the amount lands in the owner&apos;s wallet and is
          recorded against their white label.
        </p>
      </div>
      <ErrorBanner message={error} />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Reward rules</h2>
        <div className="card divide-y divide-border">
          {rules.length === 0 && (
            <p className="px-5 py-4 text-sm text-muted">
              Nothing pays a reward yet — set an amount on a training video or exam.
            </p>
          )}
          {rules.map((r) => (
            <div key={`${r.kind}-${r.id}`} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.title}</p>
                <p className="text-xs text-muted">
                  {r.kind}
                  {r.published ? "" : " · draft"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="mono-num text-sm text-success">{fmtNum(r.reward_amount)}</span>
                <Link
                  href={r.href}
                  className="rounded-md border border-border px-2.5 py-1 text-xs transition-colors hover:border-accent"
                >
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {canAdd && (
        <section className="card p-5">
          <h2 className="mb-1 text-sm font-semibold">Manual Credit</h2>
          <p className="mb-4 text-xs text-muted">
            For anything outside the rules — rent, a bonus or a correction. The owner is notified.
          </p>
          <form action={manualCredit} className="grid gap-4 sm:grid-cols-2 sm:items-end lg:grid-cols-[1fr_1fr_1fr_7rem_7rem_1fr_auto]">
            <input type="hidden" name="back" value="/admin/wallets/rewards" />
            <OwnerPicker
              owners={((owners ?? []) as unknown as (Owner & {
                merchant: { name: string } | null;
                country: { flag: string | null; name: string } | null;
              })[])
                .filter((o) => o.status !== "banned")
                .map((o) => ({
                  id: o.id,
                  name: o.full_name ?? "(no name)",
                  merchant_id: o.merchant_id,
                  merchant_name: o.merchant?.name ?? "—",
                  country_id: o.country_id ?? null,
                  country_name: o.country ? `${o.country.flag ?? ""} ${o.country.name}`.trim() : "—",
                }))}
            />
            <div>
              <label className="mb-1 block text-xs text-muted">Type</label>
              <select name="type" className="input">
                <option value="reward">Reward</option>
                <option value="rent">Rent</option>
                <option value="adjustment">Adjustment</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Amount</label>
              <MoneyInput name="amount" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Note (optional)</label>
              <input name="note" className="input" />
            </div>
            <ActionButton icon="plus" tip="Credit this amount into the owner's wallet" label="Credit" variant="primary" />
          </form>
        </section>
      )}

      <section className="space-y-2">
        <TableToolbar count={paid.total} noun="reward paid">
          <FilterForm action="/admin/wallets/rewards">
            <FilterSelect
              label="White Label"
              name="merchant"
              value={merchant}
              options={[
                { value: "", label: "All white labels" },
                ...((owners ?? []) as unknown as { merchant_id: string; merchant: { name: string } | null }[])
                  .reduce((acc, o) => {
                    if (o.merchant && !acc.some((x) => x.value === o.merchant_id)) {
                      acc.push({ value: o.merchant_id, label: o.merchant.name });
                    }
                    return acc;
                  }, [] as { value: string; label: string }[])
                  .sort((a, b) => a.label.localeCompare(b.label)),
              ]}
            />
          </FilterForm>
        </TableToolbar>
        <Table head={["When", "Owner", "White Label", "What for", "Amount"]}>
          {paid.rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-sm text-muted">Nothing paid out yet.</td>
            </tr>
          )}
          {paid.rows.map((t) => (
            <tr key={t.id} className="transition-colors hover:bg-surface-raised">
              <td className="px-4 py-2.5 text-muted">{new Date(t.created_at).toLocaleString()}</td>
              <td className="px-4 py-2.5">{t.owner?.full_name ?? "—"}</td>
              <td className="px-4 py-2.5 text-muted">{t.merchant?.name ?? "—"}</td>
              <td className="px-4 py-2.5 text-muted">{t.note ?? "—"}</td>
              <td className="mono-num px-4 py-2.5 text-right font-medium text-success">
                +{fmtNum(t.amount)} {t.wallet?.currency ?? ""}
              </td>
            </tr>
          ))}
        </Table>
        <Pagination basePath="/admin/wallets/rewards" params={{ merchant }} page={page} perPage={perPage} total={paid.total} />
      </section>
    </div>
  );
}
