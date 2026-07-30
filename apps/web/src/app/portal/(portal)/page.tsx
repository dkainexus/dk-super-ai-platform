import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { customerForUser } from "@/modules/customers/lib";
import { STATUS_COLORS, type BankAccountStatus } from "@/modules/bank-accounts/lib";
import { Table } from "@/components/data-table";

// Every account this customer is renting, across all their contracts.
export default async function PortalAccountsPage() {
  const cu = (await getCurrentUser())!;
  const c = (await customerForUser(cu.user.id))!;

  const { data } = await db()
    .from("contract_accounts")
    .select(
      "id, starts_on, ends_on, contract:contracts!inner(customer_id, status, ref), bank_account:bank_accounts(ref, account_no, status, bank:banks(name, code))"
    )
    .eq("contract.customer_id", c.id)
    .neq("contract.status", "draft")
    .order("created_at");
  const rows = (data ?? []) as unknown as {
    id: string;
    starts_on: string | null;
    ends_on: string | null;
    contract: { ref: string | null; status: string } | null;
    bank_account: { ref: string | null; account_no: string; status: string; bank: { name: string; code: string | null } | null } | null;
  }[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">My Accounts</h1>
        <p className="mt-1 text-sm text-muted">Every account on your contracts. Billing runs from the start date shown.</p>
      </div>

      <Table head={["Bank", "Account No.", "Contract", "Billing From", "Until", "Status"]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={6} className="px-4 py-6 text-sm text-muted">No accounts yet.</td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.id} className="transition-colors hover:bg-surface-raised">
            <td className="px-4 py-2.5 font-medium">
              {r.bank_account?.bank?.name ?? "—"}
              {r.bank_account?.bank?.code && (
                <span className="ml-1 text-xs font-normal text-muted">({r.bank_account.bank.code})</span>
              )}
            </td>
            <td className="mono-num px-4 py-2.5">{r.bank_account?.account_no ?? "—"}</td>
            <td className="mono-num px-4 py-2.5 text-xs text-muted">{r.contract?.ref ?? "—"}</td>
            <td className="mono-num px-4 py-2.5 text-muted">{r.starts_on ?? "—"}</td>
            <td className="mono-num px-4 py-2.5 text-muted">{r.ends_on ?? "—"}</td>
            <td className="px-4 py-2.5">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${
                  STATUS_COLORS[(r.bank_account?.status ?? "pending") as BankAccountStatus] ?? "border-border text-muted"
                }`}
              >
                {r.bank_account?.status ?? "—"}
              </span>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
