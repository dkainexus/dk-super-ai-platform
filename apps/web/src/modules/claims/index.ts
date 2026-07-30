import type { ModuleDef } from "@/modules/registry";

export const claimsModule: ModuleDef = {
  key: "claims",
  name: "Compensation",
  description: "Theft on rented accounts: compensation capped at deposits, recovery from agents, blacklisting",
  adminNav: { href: "/admin/compensation", label: "Compensation" },
};
