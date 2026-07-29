import { AuditLine } from "@/components/audit-line";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { reviewOwner, setOwnerBanned, uploadOwnerPhoto, removeOwnerPhoto } from "@/modules/owners/actions";
import { ErrorBanner } from "@/components/error-banner";
import { OwnerStatusTag } from "@/components/status-tag";
import { SubmitButton } from "@/components/action-buttons";
import { OwnerData } from "@/modules/owners/components/owner-data";
import { ImagePicker } from "@/components/image-picker";
import { signedUrl, DOCS_BUCKET } from "@/lib/storage";
import { AppAccessCard } from "@/modules/owners/components/app-access";
import type { Country, Merchant, Owner } from "@/lib/types";

export default async function AdminOwnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("owners", "view");
  const { id } = await params;
  const { error } = await searchParams;

  const { data } = await db()
    .from("owners")
    .select("*, merchant:merchants(*), country:countries(*)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const o = data as Owner & { merchant: Merchant; country: Country };

  const photo = await signedUrl(DOCS_BUCKET, o.photo_full_body_path, 60 * 30);
  const canEdit = Boolean(can(cu, "owners", "edit"));

  return (
    <div className="space-y-5">
      <Link href="/admin/owners" className="text-xs text-muted hover:text-foreground">← Owners</Link>

      <section className="card flex flex-wrap items-center gap-5 p-5">
        <ImagePicker
          url={photo}
          canEdit={canEdit}
          uploadAction={uploadOwnerPhoto}
          removeAction={removeOwnerPhoto}
          fieldName="photo"
          hidden={{ id: o.id, back: `/admin/owners/${o.id}` }}
          fallback="👤"
          tip="profile picture"
          size="h-20 w-20"
          rounded="rounded-full"
          fit="object-cover"
        />

        <div className="min-w-48 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{o.full_name || "(no name yet)"}</h1>
            <OwnerStatusTag status={o.status} />
            {(o as { ref?: string | null }).ref && (
              <span className="mono-num rounded bg-surface-raised px-1.5 py-0.5 text-[11px] text-muted">
                {(o as { ref?: string | null }).ref}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            {o.country?.flag} {o.country?.name} ·{" "}
            <Link href={`/admin/merchants/${o.merchant_id}`} className="text-accent-strong hover:underline">
              {o.merchant?.name}
            </Link>
            {o.phone ? <span className="mono-num"> · {o.phone}</span> : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/admin/owners/${o.id}/documents`}
            title="Download this owner's documents as one zip"
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
          >
            ↓ Documents
          </a>
          {canEdit && (
            <Link
              href={`/admin/owners/${o.id}/edit`}
              className="rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:border-accent"
            >
              Edit ✎
            </Link>
          )}
          {canEdit && (
            <form action={setOwnerBanned}>
              <input type="hidden" name="id" value={o.id} />
              <input type="hidden" name="banned" value={String(o.status !== "banned")} />
              <button
                type="submit"
                title={
                  o.status === "banned"
                    ? "Lift the ban (owner returns to Approved)"
                    : "Ban this owner — banned owners cannot be bound to companies"
                }
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  o.status === "banned"
                    ? "border-border text-muted hover:border-accent hover:text-foreground"
                    : "border-danger/40 text-danger hover:bg-danger/10"
                }`}
              >
                {o.status === "banned" ? "Unban" : "Ban"}
              </button>
            </form>
          )}
        </div>
      </section>

      <ErrorBanner message={error} />

      {o.status === "rejected" && o.reject_reason && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger">
          Rejection reason: {o.reject_reason}
        </div>
      )}

      <OwnerData owner={o} base="/admin/owners" />

      {can(cu, "owners", "edit") && <AppAccessCard owner={o} back={`/admin/owners/${o.id}`} />}

      {(o.status === "pending" || o.status === "draft") && (
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold">Review</h2>
          <div className="flex flex-wrap items-start gap-6">
            <form action={reviewOwner}>
              <input type="hidden" name="id" value={o.id} />
              <input type="hidden" name="decision" value="approved" />
              <SubmitButton label="Approve" />
            </form>
            <form action={reviewOwner} className="flex flex-1 items-start gap-3">
              <input type="hidden" name="id" value={o.id} />
              <input type="hidden" name="decision" value="rejected" />
              <input name="reason" placeholder="Rejection reason (required)" className="input flex-1" required />
              <SubmitButton label="Reject" variant="danger" />
            </form>
          </div>
        </section>
      )}

      <AuditLine
        createdBy={(o as { created_by?: string | null }).created_by}
        createdAt={o.created_at}
        updatedBy={(o as { updated_by?: string | null }).updated_by}
        updatedAt={(o as { updated_at?: string | null }).updated_at}
      />
    </div>
  );
}
