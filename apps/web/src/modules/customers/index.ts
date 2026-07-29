import type { ModuleDef } from "@/modules/registry";

export const customersModule: ModuleDef = {
  key: "customers",
  name: "Customers",
  description: "The people who rent bank accounts — contracts, invoices and their own sign-in",
  adminNav: { href: "/admin/customers", label: "Customers" },
};
