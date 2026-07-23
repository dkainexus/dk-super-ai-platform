import type { ModuleDef } from "@/modules/registry";

export const walletModule: ModuleDef = {
  key: "wallet",
  name: "Wallet",
  description: "Owner wallets — rewards, rent credits and withdrawal processing",
  adminNav: { href: "/admin/wallets", label: "Wallets" },
  merchantNav: { href: "/m/wallets", label: "Wallets" },
  settingsHref: "/admin/settings/wallet",
};
