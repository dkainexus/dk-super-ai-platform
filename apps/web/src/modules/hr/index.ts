import type { ModuleDef } from "@/modules/registry";

export const hrModule: ModuleDef = {
  key: "hr",
  name: "HR",
  description: "The platform's own people: employee records, departments, payroll",
  adminNav: { href: "/admin/hr", label: "HR" },
};
