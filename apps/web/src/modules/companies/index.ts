import type { ModuleDef } from "@/modules/registry";

export const companiesModule: ModuleDef = {
  key: "companies",
  name: "Companies",
  description: "Companies registered for owners — shareholders, registration data and address",
  adminNav: { href: "/admin/companies", label: "Companies" },
  merchantNav: { href: "/m/companies", label: "Companies" },
  settingsHref: "/admin/settings/companies",
};
