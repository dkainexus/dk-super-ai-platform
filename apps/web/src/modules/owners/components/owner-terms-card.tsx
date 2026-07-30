import { updateOwnerTerms } from "@/modules/owners/actions-merchant";
import { ownerContractSection } from "@/modules/contracts/policy";
import { MoneyInput } from "@/components/money-input";
import { SaveButton } from "@/components/action-buttons";

/**
 * The owner's contract terms as their own card: an approved owner's identity
 * is locked, but their terms stay changeable — within policy, from the 1st of
 * next month.
 */
export async function OwnerTermsCard({
  ownerId,
  merchantId,
  countryId,
}: {
  ownerId: string;
  merchantId: string;
  countryId: string;
}) {
  const s = await ownerContractSection(merchantId, countryId, ownerId);

  return (
    <section className="card p-5">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Contract</h2>
      <p className="mb-4 text-xs text-muted">
        One set of terms for this owner — every account they open runs on it. Changes take effect on the 1st
        of next month; months already billed stand.
      </p>
      {!s.current && (
        <p className="mb-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm text-warning">
          No terms yet — their accounts cannot be approved until these are set.
        </p>
      )}
      <form action={updateOwnerTerms} className="grid gap-4 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
        <input type="hidden" name="id" value={ownerId} />
        <div>
          <label className="mb-1 block text-xs text-muted">Rent per account / month *</label>
          <MoneyInput name="ct_rent" defaultValue={s.current?.rent ?? 0} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Contract (months) *</label>
          <input name="ct_contract_months" defaultValue={s.current?.contract_months ?? ""} className="input mono-num" required />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Renewal (months) *</label>
          <input name="ct_renewal_months" defaultValue={s.current?.renewal_months ?? ""} className="input mono-num" required />
        </div>
        <SaveButton tip="Save the terms — effective from the 1st of next month" />
      </form>
      {s.hint && <p className="mt-2 text-xs text-muted">{s.hint}</p>}
      {s.pendingNote && <p className="mt-1 text-xs text-warning">{s.pendingNote}</p>}
    </section>
  );
}
