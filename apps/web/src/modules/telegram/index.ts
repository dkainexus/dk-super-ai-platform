import type { ModuleDef } from "@/modules/registry";

export const telegramModule: ModuleDef = {
  key: "telegram",
  name: "Telegram Bot",
  description: "Shared Telegram bot registry — token validation and health checks",
  adminNav: { href: "/admin/telegram", label: "Telegram Bot" },
};
