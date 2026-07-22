import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMerchantUser, requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { env } from "@/lib/env";
import { submitOwnerForReview, deleteOwner, generateOwnerInvite } from "@/modules/owners/actions-merchant";
import { CopyField } from "@/components/copy-field";
import { banksForCountry } from "@/modules/banks/lib";
import { occupationsList } from "@/modules/owners/lib";
import { ErrorBanner } from "@/components/error-banner";
import { OwnerStatusTag } from "@/components/status-tag";
import { SubmitButton } from "@/components/action-buttons";
import { OwnerForm } from "@/modules/owners/components/owner-form";
import type { CountryField, Owner, OwnerFieldValue } from "@/lib/types";

export default async function MerchantOwnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const cu = await requireMerchantUser();
  const scope = (await requirePerm("owners", "view")).scope;
  const merchant = cu.merchant;
  const { id } = await params;
  const { error } = await searchParams;

  const { data } = await db()
    .from("owners")
    .select("*")
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .maybeSingle();
  if (!data) notFound();
  const owner = data as Owner;
  if (scope === "own" && owner.created_by && owner.created_by !== cu.user.id) notFound();

  const [{ data: fields }, { data: values }, banks, occupations] = await Promise.all([
    db()
      .from("country_fields")
      .select("*")
      .eq("country_id", merchant.country_id)
      .eq("active", true)
      .order("sort"),
    db().from("owner_field_values").select("*").eq("owner_id", owner.id),
    banksForCountry(merchant.country_id, merchant),
    occupationsList(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/m/owners" className="text-xs text-muted hover:text-foreground">
          ← Owners
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{owner.full_name || "(no name yet)"}</h1>
          <OwnerStatusTag status={owner.status} />
        </div>
      </div>
      <ErrorBanner message={error} />

      {owner.status === "rejected" && owner.reject_reason && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger">
          Rejected: {owner.reject_reason} — update the details and submit again.
        </div>
      )}
      {owner.status === "pending" && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm text-warning">
          Submitted for review. You can still edit the details while it is pending.
        </div>
      )}

      {/* Telegram intake */}
      <section className="card p-5">
        <h2 className="mb-2 text-sm font-semibold">Collect via Telegram</h2>
        {owner.telegram_user_id ? (
          <p className="text-sm text-muted">
            ✅ Telegram linked (<span className="mono-num">{owner.telegram_user_id}</span>). The owner can continue submitting documents in the bot chat.
          </p>
        ) : owner.invite_token && owner.invite_expires_at && new Date(owner.invite_expires_at) > new Date() ? (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              Send this link to the owner — the bot collects everything step by step (valid 7 days; regenerating invalidates the old link):
            </p>
            <CopyField value={`https://t.me/${env.onboardingBotUsername()}?start=${owner.invite_token}`} />
          </div>
        ) : (
          <p className="text-sm text-muted">No invite link yet. Generate one and send it to the owner — the Telegram bot collects the data automatically.</p>
        )}
        {owner.status !== "approved" && owner.status !== "pending" && (
          <form action={generateOwnerInvite} className="mt-3">
            <input type="hidden" name="id" value={owner.id} />
            <SubmitButton label={owner.invite_token ? "Regenerate Invite Link" : "Generate Invite Link"} variant="outline" />
          </form>
        )}
      </section>

      <div className="card p-5">
        <OwnerForm
          fields={(fields ?? []) as CountryField[]}
          banks={banks}
          occupations={occupations}
          owner={owner}
          values={(values ?? []) as OwnerFieldValue[]}
        />
      </div>

      {owner.status !== "approved" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {owner.status !== "pending" ? (
            <form action={submitOwnerForReview}>
              <input type="hidden" name="id" value={owner.id} />
              <SubmitButton label="Submit for Review" />
            </form>
          ) : (
            <span />
          )}
          <form action={deleteOwner}>
            <input type="hidden" name="id" value={owner.id} />
            <SubmitButton label="Delete Owner" variant="danger" />
          </form>
        </div>
      )}
    </div>
  );
}
