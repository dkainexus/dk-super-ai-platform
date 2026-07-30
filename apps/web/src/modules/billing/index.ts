import type { ModuleDef } from "@/modules/registry";

export const billingModule: ModuleDef = {
  key: "billing",
  name: "Billing",
  description: "The monthly run that turns contracts into invoices and payouts",
  adminNav: { href: "/admin/billing", label: "Billing" },
  merchantNav: { href: "/m/settlements", label: "Settlements" },
};
