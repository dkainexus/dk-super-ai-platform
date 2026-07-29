import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { addPaymentChannel, removePaymentChannel } from "@/modules/countries/actions";
import { requireCountryScope } from "@/modules/countries/lib";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";

// Payment channels available in this country (PromptPay, MoMo, QR Pay…).
// Each bank then ticks the ones it supports on its own page.
export default async function PaymentChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("banks", "view");
  const { error } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const { data: country } = await db()
    .from("countries")
    .select("payment_channels")
    .eq("id", active.id)
    .maybeSingle();
  const channels = ((country?.payment_channels ?? []) as string[]) ?? [];
  const canEdit = Boolean(can(cu, "banks", "edit"));
  const back = "/admin/banks/channels";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/banks" className="text-xs text-muted hover:text-foreground">← Banks</Link>
        <h1 className="mt-1 text-xl font-semibold">Payment Channels</h1>
        <p className="mt-1 text-sm text-muted">
          Channels available in {active.name} — every bank here offers them, and account submissions ask which
          ones the account has.
        </p>
      </div>
      <ErrorBanner message={error} />

      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {channels.length === 0 && <p className="text-sm text-muted">No channels yet.</p>}
          {channels.map((ch) => (
            <form key={ch} action={removePaymentChannel} className="inline-flex">
              <input type="hidden" name="country_id" value={active.id} />
              <input type="hidden" name="channel" value={ch} />
              <input type="hidden" name="back" value={back} />
              <button
                type="submit"
                disabled={!canEdit}
                title={`Remove ${ch}`}
                className="group inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-xs text-accent-strong transition-colors hover:border-danger/60 hover:text-danger disabled:opacity-60"
              >
                {ch} <span className="text-muted group-hover:text-danger">✕</span>
              </button>
            </form>
          ))}
        </div>
        {canEdit && (
          <form action={addPaymentChannel} className="flex max-w-sm items-end gap-3">
            <input type="hidden" name="country_id" value={active.id} />
            <input type="hidden" name="back" value={back} />
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted">New Channel</label>
              <input name="channel" placeholder="e.g. PromptPay" className="input" required />
            </div>
            <ActionButton icon="plus" tip="Add this payment channel" label="Add" variant="primary" />
          </form>
        )}
      </section>

    </div>
  );
}
