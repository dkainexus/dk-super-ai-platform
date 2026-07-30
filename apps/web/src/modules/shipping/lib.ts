import "server-only";
import { db } from "@/lib/supabase";

export type Shipment = {
  id: string;
  ref: string | null;
  merchant_id: string;
  country_id: string | null;
  customer_id: string | null;
  source_type: string;
  assignment_id: string | null;
  address: { name: string; phone: string; address: string };
  courier: string | null;
  tracking_no: string | null;
  shipped_at: string | null;
  received_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};

export type ShipmentRow = Shipment & {
  customer: { name: string; ref: string | null } | null;
  assignment: {
    ref: string | null;
    status: string;
    bank_account: { account_no: string; bank: { name: string } | null } | null;
  } | null;
};

export const SHIPMENT_SELECT =
  "*, customer:customers(name, ref), assignment:account_assignments(ref, status, bank_account:bank_accounts(account_no, bank:banks(name)))";

/** Where a shipment stands, derived — one truth, no second status column. */
export function shipmentStage(s: Shipment): "to_ship" | "in_transit" | "received" | "cancelled" {
  if (s.cancelled_at) return "cancelled";
  if (s.received_at) return "received";
  if (s.shipped_at) return "in_transit";
  return "to_ship";
}

export async function shipmentsFor(opts: { countryId?: string; stage?: string }): Promise<ShipmentRow[]> {
  let q = db().from("shipments").select(SHIPMENT_SELECT).order("created_at", { ascending: false });
  if (opts.countryId) q = q.eq("country_id", opts.countryId);
  const { data } = await q;
  let rows = (data ?? []) as unknown as ShipmentRow[];
  if (opts.stage) rows = rows.filter((s) => shipmentStage(s) === opts.stage);
  return rows;
}

export async function shipmentForAssignment(assignmentId: string): Promise<Shipment | null> {
  const { data } = await db()
    .from("shipments")
    .select("*")
    .eq("assignment_id", assignmentId)
    .is("cancelled_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  return ((data ?? [])[0] ?? null) as Shipment | null;
}
