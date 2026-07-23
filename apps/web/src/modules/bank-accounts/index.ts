import type { ModuleDef } from "@/modules/registry";

export const bankAccountsModule: ModuleDef = {
  key: "bank_accounts",
  name: "Bank Accounts",
  description: "Company bank accounts — submitted from the app or created by admins, with review workflow",
  adminNav: { href: "/admin/bank-accounts", label: "Bank Accounts" },
  merchantNav: { href: "/m/bank-accounts", label: "Bank Accounts" },
};
