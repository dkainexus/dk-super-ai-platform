import { NextRequest } from "next/server";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { adminCountry } from "@/modules/countries/lib";
import type { Withdrawal } from "@/lib/types";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Download the withdrawal queue as CSV, honouring the filters on the page.
export async function GET(req: NextRequest) {
  await requirePerm("wallet", "view");
  const status = req.nextUrl.searchParams.get("status") ?? "";
  const merchant = req.nextUrl.searchParams.get("merchant") ?? "";
  const { active } = await adminCountry();

  let oq = db().from("owners").select("id, full_name, ref, merchant:merchants(name)");
  if (active) oq = oq.eq("country_id", active.id);
  if (merchant) oq = oq.eq("merchant_id", merchant);
  const { data: owners } = await oq;
  const ownerRows = (owners ?? []) as unknown as {
    id: string;
    full_name: string | null;
    ref: string | null;
    merchant: { name: string } | null;
  }[];
  const byId = new Map(ownerRows.map((o) => [o.id, o]));

  let wq = db()
    .from("withdrawals")
    .select("*")
    .in("owner_id", ownerRows.map((o) => o.id))
    .order("requested_at", { ascending: false });
  if (status) wq = wq.eq("status", status);
  const { data } = await wq;
  const rows = (data ?? []) as Withdrawal[];

  const header = [
    "Owner ID",
    "Owner",
    "White Label",
    "Amount",
    "Currency",
    "Bank",
    "Account No",
    "Status",
    "Requested",
    "Processed",
    "Reject Reason",
  ];
  const lines = [header.join(",")];
  for (const w of rows) {
    const o = byId.get(w.owner_id);
    lines.push(
      [
        o?.ref ?? "",
        o?.full_name ?? "",
        o?.merchant?.name ?? "",
        w.amount,
        w.currency,
        w.bank_name ?? "",
        w.bank_account_no ?? "",
        w.status,
        w.requested_at,
        w.processed_at ?? "",
        w.reject_reason ?? "",
      ]
        .map(cell)
        .join(",")
    );
  }

  const name = `withdrawals-${active?.code ?? "all"}${status ? `-${status}` : ""}.csv`;
  return new Response("﻿" + lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
    },
  });
}
