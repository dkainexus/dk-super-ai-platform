/* eslint-disable @next/next/no-img-element */
// Dynamic owner form: built-in fields + the country's active custom fields.
// Server component; posts to the saveOwner server action. Existing file
// uploads are previewed via signed URLs and kept unless a new file is chosen.

import { signedUrl, DOCS_BUCKET } from "@/lib/storage";
import { saveOwner } from "@/app/actions/merchant";
import { SaveButton } from "@/components/action-buttons";
import type { CountryField, Owner, OwnerFieldValue } from "@/lib/types";

async function FilePreview({ path }: { path: string | null | undefined }) {
  const url = await signedUrl(DOCS_BUCKET, path ?? null);
  if (!url) return null;
  const isPdf = (path ?? "").toLowerCase().endsWith(".pdf");
  return (
    <a href={url} target="_blank" rel="noreferrer" className="mb-2 block">
      {isPdf ? (
        <span className="text-xs text-accent-strong underline">已上传 PDF（点击查看）</span>
      ) : (
        <img src={url} alt="" className="h-24 w-auto rounded-lg border border-border object-cover" />
      )}
    </a>
  );
}

export async function OwnerForm({
  fields,
  owner,
  values,
}: {
  fields: CountryField[];
  owner?: Owner;
  values?: OwnerFieldValue[];
}) {
  const byField = new Map((values ?? []).map((v) => [v.field_id, v]));
  const locked = owner?.status === "approved";

  return (
    <form action={saveOwner} className="space-y-6">
      {owner && <input type="hidden" name="id" value={owner.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted">姓名 *</label>
          <input name="full_name" defaultValue={owner?.full_name ?? ""} className="input" required disabled={locked} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">ID 号码 *</label>
          <input name="id_number" defaultValue={owner?.id_number ?? ""} className="input mono-num" disabled={locked} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">ID 正面照片 *</label>
          <FilePreview path={owner?.id_front_path} />
          {!locked && <input name="id_front" type="file" accept="image/*,.pdf" className="input" />}
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">ID 背面照片 *</label>
          <FilePreview path={owner?.id_back_path} />
          {!locked && <input name="id_back" type="file" accept="image/*,.pdf" className="input" />}
        </div>
      </div>

      {fields.length > 0 && (
        <div className="border-t border-border pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">国家自定义字段</p>
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
                      {!locked && <input name={`cff_${f.id}`} type="file" accept="image/*,.pdf" className="input" />}
                    </>
                  ) : f.field_type === "select" ? (
                    <select name={`cf_${f.id}`} defaultValue={v?.value_text ?? ""} className="input" disabled={locked}>
                      <option value="">— 请选择 —</option>
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
        <label className="mb-1 block text-xs text-muted">备注（可选）</label>
        <textarea name="notes" defaultValue={owner?.notes ?? ""} rows={2} className="input" disabled={locked} />
      </div>

      {!locked && <SaveButton label={owner ? "保存修改" : "创建 Owner"} />}
    </form>
  );
}
