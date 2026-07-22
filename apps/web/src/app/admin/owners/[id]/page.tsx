import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { reviewOwner } from "@/app/actions/cms";
import { ErrorBanner } from "@/components/error-banner";
import { OwnerStatusTag } from "@/components/status-tag";
import { SubmitButton } from "@/components/action-buttons";
import { OwnerData } from "@/components/owner-data";
import type { Country, Merchant, Owner } from "@/lib/types";

export default async function AdminOwnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePerm("owners", "view");
  const { id } = await params;
  const { error } = await searchParams;

  const { data } = await db()
    .from("owners")
    .select("*, merchant:merchants(*), country:countries(*)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const o = data as Owner & { merchant: Merchant; country: Country };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/owners" className="text-xs text-muted hover:text-foreground">
          ← Owners
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{o.full_name || "(no name yet)"}</h1>
          <OwnerStatusTag status={o.status} />
        </div>
        <p className="mt-1 text-sm text-muted">
          {o.country?.flag} {o.country?.name} · Merchant: 
          <Link href={`/admin/merchants/${o.merchant_id}`} className="text-accent-strong hover:underline">
            {o.merchant?.name}
          </Link>
        </p>
      </div>
      <ErrorBanner message={error} />

      {o.status === "rejected" && o.reject_reason && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger">
          Rejection reason: {o.reject_reason}
        </div>
      )}

      <section className="card p-5">
        <OwnerData owner={o} />
      </section>

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
    </div>
  );
}
