import type { ModuleDef } from "@/modules/registry";

export const notificationsModule: ModuleDef = {
  key: "notifications",
  name: "Notifications",
  description: "In-app notifications pushed to owners (company, rewards, training)",
  adminNav: { href: "/admin/notifications", label: "Notifications" },
  merchantNav: { href: "/m/notifications", label: "Notifications" },
};
