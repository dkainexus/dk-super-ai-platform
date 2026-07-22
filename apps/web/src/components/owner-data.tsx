/* eslint-disable @next/next/no-img-element */
// Read-only view of an owner's data: built-in fields, ID photos, and the
// country's custom fields (async server component; generates signed URLs).

import { db } from "@/lib/supabase";
import { signedUrl, DOCS_BUCKET } from "@/lib/storage";
import type { CountryField, Owner, OwnerFieldValue } from "@/lib/types";

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

async function FileThumb({ path, label }: { path: string | null; label: string }) {
  const url = await signedUrl(DOCS_BUCKET, path);
  if (!url) return <span className="text-sm text-muted">未上传</span>;
  const isPdf = (path ?? "").toLowerCase().endsWith(".pdf");
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      {isPdf ? (
        <span className="text-sm text-accent-strong underline">查看 PDF</span>
      ) : (
        <img
          src={url}
          alt={label}
          className="h-32 w-auto rounded-lg border border-border object-cover transition-opacity hover:opacity-80"
        />
      )}
    </a>
  );
}

export async function OwnerData({ owner }: { owner: Owner }) {
  const [{ data: fields }, { data: values }] = await Promise.all([
    db().from("country_fields").select("*").eq("country_id", owner.country_id).order("sort"),
    db().from("owner_field_values").select("*").eq("owner_id", owner.id),
  ]);
  const byField = new Map(
    ((values ?? []) as OwnerFieldValue[]).map((v) => [v.field_id, v])
  );
  // Show inactive fields too when they already hold a value (historic data).
  const visible = ((fields ?? []) as CountryField[]).filter(
    (f) => f.active || byField.has(f.id)
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Item label="姓名">{owner.full_name || <span className="text-muted">未填写</span>}</Item>
        <Item label="ID 号码">
          <span className="mono-num">{owner.id_number || "—"}</span>
        </Item>
        <Item label="ID 正面">
          <FileThumb path={owner.id_front_path} label="ID front" />
        </Item>
        <Item label="ID 背面">
          <FileThumb path={owner.id_back_path} label="ID back" />
        </Item>
      </div>

      {visible.length > 0 && (
        <div className="border-t border-border pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">国家自定义字段</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {visible.map((f) => {
              const v = byField.get(f.id);
              return (
                <Item key={f.id} label={`${f.label}${f.required ? " *" : ""}`}>
                  {f.field_type === "file" ? (
                    <FileThumb path={v?.file_path ?? null} label={f.label} />
                  ) : (
                    <span className={f.field_type === "number" ? "mono-num" : ""}>
                      {v?.value_text || <span className="text-muted">未填写</span>}
                    </span>
                  )}
                </Item>
              );
            })}
          </div>
        </div>
      )}

      {owner.notes && (
        <div className="border-t border-border pt-4">
          <Item label="备注">{owner.notes}</Item>
        </div>
      )}
    </div>
  );
}
