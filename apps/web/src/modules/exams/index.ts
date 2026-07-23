import type { ModuleDef } from "@/modules/registry";

export const examsModule: ModuleDef = {
  key: "exams",
  name: "Exams",
  description: "Question bank, exam papers and the AI examiner for the mobile app",
  adminNav: { href: "/admin/exams", label: "Exams" },
  merchantNav: { href: "/m/exams", label: "Exams" },
};
