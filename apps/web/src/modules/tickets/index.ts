import type { ModuleDef } from "@/modules/registry";

export const ticketsModule: ModuleDef = {
  key: "tickets",
  name: "Support",
  description: "Problems on rented accounts: triage, evidence, deadlines and the billing freeze",
  adminNav: { href: "/admin/tickets", label: "Support" },
};
