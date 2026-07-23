"use client";

// New bank account form: company → bank (filtered by the company's country)
// → standard fields + the bank's own extra fields + its payment channels.

import { useMemo, useState } from "react";
import { createBankAccount } from "../actions";
import { SaveButton } from "@/components/action-buttons";

export type FormCompany = { id: string; name: string; country_id: string | null; merchant_name?: string };
export type FormBank = {
  id: string;
  name: string;
  country_id: string;
  account_fields: { key: string; label: string }[];
  channels: string[];
};

export function BankAccountForm({ companies, banks }: { companies: FormCompany[]; banks: FormBank[] }) {
  const [companyId, setCompanyId] = useState("");
  const [bankId, setBankId] = useState("");

  const company = companies.find((c) => c.id === companyId) ?? null;
  const bankOptions = useMemo(
    () => (company?.country_id ? banks.filter((b) => b.country_id === company.country_id) : banks),
    [banks, company?.country_id]
  );
  const bank = bankOptions.find((b) => b.id === bankId) ?? null;

  return (
    <form action={createBankAccount} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted">Company</label>
          <select
            name="company_id"
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              setBankId("");
            }}
            className="input"
            required
          >
            <option value="">— Select a company —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.merchant_name ? ` (${c.merchant_name})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Bank</label>
          <select
            name="bank_id"
            value={bankId}
            onChange={(e) => setBankId(e.target.value)}
            className="input"
            required
            disabled={!companyId}
          >
            <option value="">{companyId ? "— Select a bank —" : "Choose a company first"}</option>
            {bankOptions.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {bank && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-muted">Branch Address</label>
              <input name="branch_address" className="input" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Account Number</label>
              <input name="account_no" className="input mono-num" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Account Limit</label>
              <input name="account_limit" type="number" step="0.01" className="input mono-num" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Email</label>
              <input name="email" type="email" className="input" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">SIM Card Number</label>
              <input name="sim_number" className="input mono-num" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Login / User ID</label>
              <input name="login_id" className="input" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Password</label>
              <input name="password" className="input" />
            </div>
            {bank.account_fields.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs text-muted">{f.label} ({bank.name})</label>
                <input name={`extra_${f.key}`} className="input" />
              </div>
            ))}
          </div>

          {bank.channels.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Payment Channels</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {bank.channels.map((c) => (
                  <div key={c} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name={`channel_${c}`} /> {c}
                    </label>
                    <input
                      name={`channel_${c}_value`}
                      placeholder="Linked number / ID (optional)"
                      className="input flex-1 py-1 text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <SaveButton label="Create Account (pending review)" tip="Create this bank account for review" />
        </>
      )}
    </form>
  );
}
