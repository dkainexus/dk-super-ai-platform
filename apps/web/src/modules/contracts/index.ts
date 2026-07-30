import type { ModuleDef } from "@/modules/registry";

export const contractsModule: ModuleDef = {
  key: "contracts",
  name: "Contracts",
  description: "Rental terms for customers, agents and owners — per-account, versioned",
  adminNav: { href: "/admin/contracts", label: "Contracts" },
  merchantNav: { href: "/m/contract-policy", label: "Contract Policy" },
};
