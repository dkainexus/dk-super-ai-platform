/* eslint-disable @next/next/no-img-element */
// Read-only profile view of an owner: personal details, identity documents,
// banking and the country's custom fields (async server component; generates
// signed URLs).

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

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function DownloadLink({ href, tip, label }: { href: string; tip: string; label: string }) {
  return (
    <a
      href={href}
      title={tip}
      className="rounded-md border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
    >
      ↓ {label}
    </a>
  );
}

/** A document with its preview — click the image to open, the caption to save. */
async function DocCard({
  path,
  label,
  downloadHref,
}: {
  path: string | null;
  label: string;
  downloadHref?: string;
}) {
  const url = await signedUrl(DOCS_BUCKET, path);
  const isPdf = (path ?? "").toLowerCase().endsWith(".pdf");

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted">{label}</p>
      {!url ? (
        <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted">
          Not uploaded
        </div>
      ) : isPdf ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex h-36 items-center justify-center rounded-lg border border-border text-sm text-accent-strong underline"
        >
          View PDF
        </a>
      ) : (
        <a href={url} target="_blank" rel="noreferrer" title={`Open ${label}`} className="block">
          <img
            src={url}
            alt={label}
            className="h-36 w-full rounded-lg border border-border object-cover transition-opacity hover:opacity-80"
          />
        </a>
      )}
      {url && downloadHref && (
        <a href={downloadHref} className="text-[11px] text-muted underline hover:text-foreground" title={`Download ${label}`}>
          Download
        </a>
      )}
    </div>
  );
}

export async function OwnerData({ owner, base }: { owner: Owner; base: string }) {
  const [{ data: fields }, { data: values }, { data: bank }, { data: occupation }] = await Promise.all([
    db().from("country_fields").select("*").eq("country_id", owner.country_id).order("sort"),
    db().from("owner_field_values").select("*").eq("owner_id", owner.id),
    owner.bank_id
      ? db().from("banks").select("name, code").eq("id", owner.bank_id).maybeSingle()
      : Promise.resolve({ data: null }),
    owner.occupation_id
      ? db().from("occupations").select("name, company_type").eq("id", owner.occupation_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const byField = new Map(((values ?? []) as OwnerFieldValue[]).map((v) => [v.field_id, v]));
  // Show inactive fields too when they already hold a value (historic data).
  const visible = ((fields ?? []) as CountryField[]).filter((f) => f.active || byField.has(f.id));
  const fileFields = visible.filter((f) => f.field_type === "file");
  const dataFields = visible.filter((f) => f.field_type !== "file");
  const hasIdPhotos = Boolean(owner.id_front_path || owner.id_back_path);
  const docsHref = `${base}/${owner.id}/documents`;

  return (
    <div className="space-y-5">
      <Section title="Personal Details">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Item label="Full Name">{owner.full_name || <span className="text-muted">Not provided</span>}</Item>
          <Item label="ID Number">
            <span className="mono-num">{owner.id_number || "—"}</span>
          </Item>
          <Item label="Gender">
            <span className="capitalize">{owner.gender || <span className="text-muted">Not provided</span>}</span>
          </Item>
          <Item label="Marital Status">
            <span className="capitalize">
              {owner.marital_status || <span className="text-muted">Not provided</span>}
            </span>
          </Item>
          <Item label="Phone Number">
            <span className="mono-num">{owner.phone || "—"}</span>
          </Item>
          <Item label="Private Email">
            <span className="mono-num">{owner.email || "—"}</span>
          </Item>
          <Item label="Occupation">
            {occupation ? (
              <span>
                {occupation.name}
                {occupation.company_type && (
                  <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-strong">
                    → {occupation.company_type}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted">Not selected</span>
            )}
          </Item>
          {dataFields.map((f) => (
            <Item key={f.id} label={`${f.label}${f.required ? " *" : ""}`}>
              <span className={f.field_type === "number" ? "mono-num" : ""}>
                {byField.get(f.id)?.value_text || <span className="text-muted">Not provided</span>}
              </span>
            </Item>
          ))}
        </div>
      </Section>

      <Section
        title="Identity Documents"
        action={
          hasIdPhotos && (
            <DownloadLink
              href={`${docsHref}?group=id`}
              tip="Download the front and back of the ID card as one zip"
              label="Download ID (front + back)"
            />
          )
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <DocCard path={owner.id_front_path} label="ID Front" />
          <DocCard path={owner.id_back_path} label="ID Back" />
          <DocCard path={owner.photo_full_body_path} label="Full-Body Photo" />
        </div>
      </Section>

      {fileFields.length > 0 && (
        <Section
          title="Other Documents"
          action={<DownloadLink href={docsHref} tip="Download every downloadable document as one zip" label="Download all" />}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {fileFields.map((f) => (
              <DocCard
                key={f.id}
                path={byField.get(f.id)?.file_path ?? null}
                label={f.label}
                downloadHref={(f as CountryField & { downloadable?: boolean }).downloadable ? docsHref : undefined}
              />
            ))}
          </div>
        </Section>
      )}

      <Section title="Banking">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Item label="Bank">
            {bank ? (
              <span>
                {bank.name} {bank.code && <span className="mono-num text-xs text-muted">({bank.code})</span>}
              </span>
            ) : (
              <span className="text-muted">Not selected</span>
            )}
          </Item>
          <Item label="Bank Account Number">
            <span className="mono-num">{owner.bank_account_no || "—"}</span>
          </Item>
        </div>
      </Section>

      {owner.notes && (
        <Section title="Notes">
          <p className="text-sm">{owner.notes}</p>
        </Section>
      )}
    </div>
  );
}
