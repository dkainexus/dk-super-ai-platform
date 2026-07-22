// Company form (server component) — used by both /admin and /m sides.
// Owner binding is required; the shareholders block only appears for
// countries with shareholders enabled in the Companies module settings.

import { saveCompany } from "@/modules/companies/actions";
import { SaveButton } from "@/components/action-buttons";
import { COMPANY_STATUS_LABEL, type Company, type CompanyMember, type Owner } from "@/lib/types";
import { OwnerTypePicker, ShareholderRows, type OwnerOption } from "./company-form-parts";

export function CompanyForm({
  owners,
  occupationTypeByOwner,
  company,
  members = [],
  shareholdersEnabled,
  hidden = {},
}: {
  owners: Owner[];
  occupationTypeByOwner: Map<string, string | null>;
  company?: Company;
  members?: CompanyMember[];
  shareholdersEnabled: boolean;
  hidden?: Record<string, string>;
}) {
  const ownerOptions: OwnerOption[] = owners.map((o) => ({
    id: o.id,
    name: o.full_name || "(no name)",
    companyType: occupationTypeByOwner.get(o.id) ?? null,
  }));
  const boundOwner = members.find((m) => m.role === "owner");
  const shareholders = members
    .filter((m) => m.role === "shareholder")
    .map((m) => ({ ownerId: m.owner_id, percent: String(m.share_percent ?? "") }));

  return (
    <form action={saveCompany} className="space-y-6">
      {company && <input type="hidden" name="id" value={company.id} />}
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted">Company Name *</label>
          <input name="name" defaultValue={company?.name ?? ""} className="input" required />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Company ID (registration number)</label>
          <input name="company_id" defaultValue={company?.company_id ?? ""} className="input mono-num" />
        </div>
        <OwnerTypePicker
          owners={ownerOptions}
          ownerId={boundOwner?.owner_id ?? ""}
          companyType={company?.company_type ?? ""}
        />
        <div>
          <label className="mb-1 block text-xs text-muted">Business Start Date</label>
          <input
            name="business_start_date"
            type="date"
            defaultValue={company?.business_start_date ?? ""}
            className="input mono-num"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Status</label>
          <select name="status" defaultValue={company?.status ?? "preparing"} className="input">
            {Object.entries(COMPANY_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Address</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-muted">No. / Building</label>
            <input name="address_no" defaultValue={company?.address_no ?? ""} className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted">Street / Road</label>
            <input name="street" defaultValue={company?.street ?? ""} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Subdistrict</label>
            <input name="subdistrict" defaultValue={company?.subdistrict ?? ""} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">District</label>
            <input name="district" defaultValue={company?.district ?? ""} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Province</label>
            <input name="province" defaultValue={company?.province ?? ""} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Postal Code</label>
            <input name="postal_code" defaultValue={company?.postal_code ?? ""} className="input mono-num" />
          </div>
        </div>
      </div>

      {shareholdersEnabled && (
        <div className="border-t border-border pt-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Shareholders</p>
          <p className="mb-3 text-xs text-muted">
            Shareholders come from the same white label&apos;s owner pool. Total share cannot exceed 100%.
          </p>
          <ShareholderRows owners={ownerOptions} initial={shareholders} />
        </div>
      )}

      <div className="border-t border-border pt-4">
        <label className="mb-1 block text-xs text-muted">Notes (optional)</label>
        <textarea name="notes" defaultValue={company?.notes ?? ""} rows={2} className="input" />
      </div>

      <SaveButton label={company ? "Save Changes" : "Create Company"} />
    </form>
  );
}
