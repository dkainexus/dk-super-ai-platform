import type { ModuleDef } from "@/modules/registry";

export const expensesModule: ModuleDef = {
  key: "expenses",
  name: "Expenses",
  description: "Everything the platform spends: company costs, staff claims, devices",
  adminNav: { href: "/admin/expenses", label: "Expenses" },
};
