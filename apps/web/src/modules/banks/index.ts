import type { ModuleDef } from "@/modules/registry";

export const banksModule: ModuleDef = {
  key: "banks",
  name: "Banks",
  description: "Per-country bank directory used across the platform",
  adminNav: { href: "/admin/banks", label: "Banks" },
};
