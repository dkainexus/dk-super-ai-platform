import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { requireCountryScope } from "@/modules/countries/lib";
import { reviewTurnover } from "@/modules/billing/actions";
import { signedUrl, DOCS_BUCKET } from "@/lib/storage";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { fmtNum } from "@/lib/format";

type Row = {
  id: string;
  period_month: string;
  amount: number;
  status: string;
  reject_reason: string | null;
  statement_path: string | null;
  created_at: string;
  customer: { name: string; ref: string | null } | null;
  bank_account: { account_no: string; bank: { name: string } | null } | null;
};

// The queue of declared turnovers. Approving one is what lets the next run
// raise the top-up, so the statement is right here to check against.
export default async function TurnoverReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("billing", "view");
  const { error } = await searchParams;
  const { active } = await requireCountryScope();

  let q = db()
    .from("turnover_declarations")
    .select(
      "*, customer:customers!inner(name, ref, country_id), bank_account:bank_accounts(account_no, bank:banks(name))"
    )
    .order("status")
    .order("period_month", { ascending: false })
    .limit(100);
  if (active) q = q.eq("customer.country_id", active.id);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Row[];
  const pending = rows.filter((r) => r.status === "pending");
  const done = rows.filter((r) => r.status !== "pending");
  const canEdit = Boolean(can(cu, "billing", "edit"));

  const statementLinks = new Map<string, string | null>();
  for (const r of pending) {
    statementLinks.set(r.id, await signedUrl(DOCS_BUCKET, r.statement_path, 1800));
  }

  const card = (r: Row, actions: boolean) => (
    <section key={r.id} className={`card space-y-3 p-4 ${r.status === "pending" ? "glow-border" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            {r.customer?.name ?? "?"}
            <span className="mono-num ml-2 text-xs font-normal text-muted">{r.customer?.ref}</span>
          </p>
          <p className="text-xs text-muted">
            {r.bank_account?.bank?.name ?? "?"} {r.bank_account?.account_no} · {r.period_month.slice(0, 7)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="mono-num text-base font-semibold">{fmtNum(r.amount)}</p>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${
              r.status === "approved"
                ? "border-success/40 bg-success/10 text-success"
                : r.status === "rejected"
                  ? "border-danger/40 bg-danger/10 text-danger"
                  : "border-warning/40 bg-warning/10 text-warning"
            }`}
          >
            {r.status}
          </span>
        </div>
      </div>
      {r.reject_reason && <p className="text-xs text-danger">Rejected: {r.reject_reason}</p>}
      {actions && canEdit && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {statementLinks.get(r.id) ? (
            <a
              href={statementLinks.get(r.id)!}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
            >
              View Statement ↗
            </a>
          ) : (
            <span className="text-xs text-danger">No statement attached</span>
          )}
          <form action={reviewTurnover}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="decision" value="approve" />
            <ActionButton icon="check" tip="The statement matches — approve; the top-up joins the next run" label="Approve" variant="success" />
          </form>
          <form action={reviewTurnover} className="flex items-center gap-2">
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="decision" value="reject" />
            <input name="reason" placeholder="Why it is rejected…" className="input w-56 py-1.5 text-xs" required />
            <ActionButton icon="x" tip="Reject — the customer resubmits against this reason" label="Reject" variant="danger" />
          </form>
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/billing" className="text-xs text-muted hover:text-foreground">← Billing</Link>
        <h1 className="mt-1 text-xl font-semibold">Turnover Review</h1>
        <p className="mt-1 text-sm text-muted">
          Check each figure against its statement. Only an approved month can raise a top-up.
        </p>
      </div>
      <ErrorBanner message={error} />

      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
        Waiting — {pending.length}
      </h2>
      {pending.length === 0 && <p className="card px-5 py-6 text-sm text-muted">Nothing waiting.</p>}
      {pending.map((r) => card(r, true))}

      {done.length > 0 && (
        <>
          <h2 className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted">Reviewed</h2>
          {done.slice(0, 20).map((r) => card(r, false))}
        </>
      )}
    </div>
  );
}
