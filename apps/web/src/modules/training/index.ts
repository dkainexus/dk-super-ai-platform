import type { ModuleDef } from "@/modules/registry";

export const trainingModule: ModuleDef = {
  key: "training",
  name: "Training",
  description: "Training video library streamed to the mobile app",
  adminNav: { href: "/admin/training", label: "Training" },
  merchantNav: { href: "/m/training", label: "Training" },
};
