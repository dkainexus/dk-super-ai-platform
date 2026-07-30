import { requireMerchantUser, requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { activeCountry } from "@/modules/merchants/lib";
import { contractPolicy, conditionRows } from "@/modules/contracts/policy";
import { savePolicy, saveRenewModes } from "@/modules/contracts/policy-actions";
import { ConditionTable } from "@/modules/contracts/components/condition-table";
import { ErrorBanner } from "@/components/error-banner";
import { SaveButton } from "@/components/action-buttons";
import { MoneyInput } from "@/components/money-input";

// The white label's contract rules: what an agent may sign an owner up at,
// and the default agent conditions a new agent starts from.
export default async function ContractPolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const cu = await requireMerchantUser();
  await requirePerm("contracts", "view");
  const { error, saved } = await searchParams;
  const { active } = await activeCountry(cu);
  if (!active) return <p className="card px-5 py-6 text-sm text-muted">No country selected.</p>;

  const [policy, template, { data: banks }, { data: country }] = await Promise.all([
    contractPolicy(cu.merchant.id, active.id),
    conditionRows(cu.merchant.id, active.id, null),
    db().from("banks").select("id, name").eq("country_id", active.id).eq("active", true).order("sort"),
    db().from("countries").select("payment_channels").eq("id", active.id).maybeSingle(),
  ]);
  const canEdit = Boolean(can(cu, "contracts", "edit"));
  const channels = ((country?.payment_channels as string[] | null) ?? []).filter(Boolean);
  const back = "/m/contract-policy";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Contract Policy — {active.flag || ""} {active.name}</h1>
        <p className="mt-1 text-sm text-muted">
          The rules your agents work within. Changes only affect what is signed or activated from now on —
          nothing already running moves.
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">Saved.</p>
      )}

      <section className="card p-5">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Owner Contract Rules</h2>
        <p className="mb-4 text-xs text-muted">
          When an agent signs up an owner they set the rent and the term — inside these bounds. Without this
          policy, agents cannot enter owner terms at all.
        </p>
        <form action={savePolicy} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <input type="hidden" name="back" value={back} />
          <div>
            <label className="mb-1 block text-xs text-muted">Rent minimum (per account)</label>
            <MoneyInput name="owner_rent_min" defaultValue={policy ? Number(policy.owner_rent_min) : 0} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Rent maximum (0 = no cap)</label>
            <MoneyInput name="owner_rent_max" defaultValue={policy ? Number(policy.owner_rent_max) : 0} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Minimum contract (months)</label>
            <input
              name="owner_min_contract_months"
              defaultValue={policy?.owner_min_contract_months ?? 6}
              className="input mono-num"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Minimum renewal (months)</label>
            <input
              name="owner_min_renewal_months"
              defaultValue={policy?.owner_min_renewal_months ?? 3}
              className="input mono-num"
            />
          </div>
          {canEdit && (
            <div className="sm:col-span-2 lg:col-span-4">
              <SaveButton tip="Save the owner rules — applies to terms entered from now on" />
            </div>
          )}
        </form>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Renewal Mode</h2>
        <p className="mb-4 text-xs text-muted">
          Auto extends an expiring owner or agent contract by its renewal months without anyone touching it.
          Manual means the platform confirms each renewal — until then, an expired contract stops billing.
        </p>
        <form action={saveRenewModes} className="grid gap-4 sm:grid-cols-3 sm:items-end">
          <div>
            <label className="mb-1 block text-xs text-muted">Owner renewals</label>
            <select name="renew_owner_mode" defaultValue={(cu.merchant as { renew_owner_mode?: string }).renew_owner_mode ?? "auto"} className="input">
              <option value="auto">Automatic</option>
              <option value="manual">Manual — platform confirms</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Agent renewals</label>
            <select name="renew_agent_mode" defaultValue={(cu.merchant as { renew_agent_mode?: string }).renew_agent_mode ?? "auto"} className="input">
              <option value="auto">Automatic</option>
              <option value="manual">Manual — platform confirms</option>
            </select>
          </div>
          {canEdit && <SaveButton tip="Save the renewal modes" />}
        </form>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Default Agent Conditions (template)
        </h2>
        <p className="mb-4 text-xs text-muted">
          Every new agent starts with a copy of this table — bank by bank, channel by channel. Each agent&apos;s
          copy can then be adjusted on their own page; accounts freeze whichever row applied on activation day.
        </p>
        <ConditionTable
          rows={template}
          banks={(banks ?? []) as { id: string; name: string }[]}
          channels={channels}
          canEdit={canEdit}
          hidden={{ back }}
          emptyText="No template rows yet — add the first below."
        />
      </section>
    </div>
  );
}
