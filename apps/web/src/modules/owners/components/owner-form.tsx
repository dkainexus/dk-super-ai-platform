/* eslint-disable @next/next/no-img-element */
// Dynamic owner form: built-in fields + the country's active custom fields.
// Server component; posts to the saveOwner server action. Existing file
// uploads are previewed via signed URLs and kept unless a new file is chosen.

import { signedUrl, DOCS_BUCKET } from "@/lib/storage";
import { PhotoInput } from "@/components/photo-input";
import { saveOwner } from "@/modules/owners/actions-merchant";
import { SaveButton } from "@/components/action-buttons";
import type { Bank, CountryField, Occupation, Owner, OwnerFieldValue } from "@/lib/types";

async function FilePreview({ path }: { path: string | null | undefined }) {
  const url = await signedUrl(DOCS_BUCKET, path ?? null);
  if (!url) return null;
  const isPdf = (path ?? "").toLowerCase().endsWith(".pdf");
  return (
    <a href={url} target="_blank" rel="noreferrer" className="mb-2 block">
      {isPdf ? (
        <span className="text-xs text-accent-strong underline">PDF uploaded (click to view)</span>
      ) : (
        <img src={url} alt="" className="h-24 w-auto rounded-lg border border-border object-cover" />
      )}
    </a>
  );
}

export async function OwnerForm({
  fields,
  banks = [],
  occupations = [],
  provinces = [],
  agents = [],
  owner,
  values,
  action = saveOwner,
  hidden = {},
  locked: lockedProp,
}: {
  fields: CountryField[];
  banks?: Bank[];
  occupations?: Occupation[];
  /** State / province choices for the owner's country */
  provinces?: string[];
  /** Agents who can be credited with introducing this owner */
  agents?: { id: string; name: string }[];
  owner?: Owner;
  values?: OwnerFieldValue[];
  action?: (formData: FormData) => Promise<void>;
  hidden?: Record<string, string>;
  locked?: boolean;
}) {
  const byField = new Map((values ?? []).map((v) => [v.field_id, v]));
  const locked = lockedProp ?? owner?.status === "approved";

  return (
    <form action={action} className="space-y-6">
      {owner && <input type="hidden" name="id" value={owner.id} />}
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted">Full Name *</label>
          <input name="full_name" defaultValue={owner?.full_name ?? ""} className="input" required disabled={locked} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">ID Number *</label>
          <input name="id_number" defaultValue={owner?.id_number ?? ""} className="input mono-num" disabled={locked} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Gender</label>
          <select name="gender" defaultValue={owner?.gender ?? ""} className="input" disabled={locked}>
            <option value="">— Select —</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Marital Status</label>
          <select name="marital_status" defaultValue={owner?.marital_status ?? ""} className="input" disabled={locked}>
            <option value="">— Select —</option>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="divorced">Divorced</option>
            <option value="widowed">Widowed</option>
          </select>
        </div>
        {agents.length > 0 && (
          <div>
            <label className="mb-1 block text-xs text-muted">Introduced by (agent)</label>
            <select
              name="agent_id"
              defaultValue={(owner as (Owner & { agent_id?: string | null }) | undefined)?.agent_id ?? ""}
              className="input"
              disabled={locked}
            >
              <option value="">Nobody / walk-in</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}
        {occupations.length > 0 && (
          <div>
            <label className="mb-1 block text-xs text-muted">Occupation</label>
            <select name="occupation_id" defaultValue={owner?.occupation_id ?? ""} className="input" disabled={locked}>
              <option value="">— Select —</option>
              {occupations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs text-muted">Phone Number</label>
          <input name="phone" defaultValue={owner?.phone ?? ""} className="input mono-num" disabled={locked} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Private Email</label>
          <input name="email" type="email" defaultValue={owner?.email ?? ""} className="input mono-num" disabled={locked} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">ID Front Photo *</label>
          <FilePreview path={owner?.id_front_path} />
          {!locked && <PhotoInput name="id_front" accept="image/*,.pdf" />}
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">ID Back Photo *</label>
          <FilePreview path={owner?.id_back_path} />
          {!locked && <PhotoInput name="id_back" accept="image/*,.pdf" />}
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Full-Body Photo *</label>
          <FilePreview path={owner?.photo_full_body_path} />
          {!locked && <PhotoInput name="photo_full_body" accept="image/*" />}
        </div>
      </div>

      {banks.length > 0 && (
        <div className="border-t border-border pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Bank Account</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted">Bank</label>
              <select name="bank_id" defaultValue={owner?.bank_id ?? ""} className="input" disabled={locked}>
                <option value="">— Select a bank —</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.code ? `(${b.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Bank Account Number</label>
              <input name="bank_account_no" defaultValue={owner?.bank_account_no ?? ""} className="input mono-num" disabled={locked} />
            </div>
          </div>
        </div>
      )}

      {/* Address — optional, but the province comes from the country's list */}
      <div className="border-t border-border pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Address</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-muted">House / Building No.</label>
            <input name="address_no" defaultValue={owner?.address_no ?? ""} className="input" disabled={locked} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Street</label>
            <input name="street" defaultValue={owner?.street ?? ""} className="input" disabled={locked} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Sub-district</label>
            <input name="subdistrict" defaultValue={owner?.subdistrict ?? ""} className="input" disabled={locked} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">District</label>
            <input name="district" defaultValue={owner?.district ?? ""} className="input" disabled={locked} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">State / Province</label>
            <select name="province" defaultValue={owner?.province ?? ""} className="input" disabled={locked}>
              <option value="">— Select —</option>
              {provinces.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Postal Code</label>
            <input name="postal_code" defaultValue={owner?.postal_code ?? ""} className="input mono-num" disabled={locked} />
          </div>
        </div>
      </div>

      {fields.length > 0 && (
        <div className="border-t border-border pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Extra Fields</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => {
              const v = byField.get(f.id);
              const label = `${f.label}${f.required ? " *" : ""}`;
              return (
                <div key={f.id}>
                  <label className="mb-1 block text-xs text-muted">{label}</label>
                  {f.field_type === "file" ? (
                    <>
                      <FilePreview path={v?.file_path} />
                      {!locked && <PhotoInput name={`cff_${f.id}`} accept="image/*,.pdf" />}
                    </>
                  ) : f.field_type === "multiselect" ? (
                    <div className="flex flex-wrap gap-2">
                      {(f.options ?? []).map((opt) => (
                        <label
                          key={opt}
                          className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:border-accent"
                        >
                          <input
                            type="checkbox"
                            name={`cf_${f.id}`}
                            value={opt}
                            defaultChecked={(v?.value_text ?? "").split(",").map((x) => x.trim()).includes(opt)}
                            disabled={locked}
                            className="h-4 w-4"
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  ) : f.field_type === "select" ? (
                    <select name={`cf_${f.id}`} defaultValue={v?.value_text ?? ""} className="input" disabled={locked}>
                      <option value="">— Select —</option>
                      {(f.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name={`cf_${f.id}`}
                      type={f.field_type === "number" ? "number" : f.field_type === "date" ? "date" : "text"}
                      defaultValue={v?.value_text ?? ""}
                      className={`input ${f.field_type === "number" ? "mono-num" : ""}`}
                      disabled={locked}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="border-t border-border pt-4">
        <label className="mb-1 block text-xs text-muted">Notes (optional)</label>
        <textarea name="notes" defaultValue={owner?.notes ?? ""} rows={2} className="input" disabled={locked} />
      </div>

      {!locked && <SaveButton label={owner ? "Save Changes" : "Create Owner"} />}
    </form>
  );
}
