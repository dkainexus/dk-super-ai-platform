// Modular menu registry.
//
// Each merchant-portal module contributes a nav item here plus its pages under
// src/app/m/<key>/. Adding a future module (training, banking, billing, …) means
// adding one entry to MERCHANT_MODULES and dropping in its route folder —
// layouts and navigation pick it up automatically.

export type ModuleDef = {
  key: string;
  label: string;
  href: string;
};

export const MERCHANT_MODULES: ModuleDef[] = [
  { key: "owners", label: "Owner 管理", href: "/m/owners" },
];

export function merchantNavSections() {
  return [
    { items: [{ href: "/m", label: "总览" }] },
    { heading: "模块", items: MERCHANT_MODULES.map((m) => ({ href: m.href, label: m.label })) },
    { heading: "设置", items: [{ href: "/m/settings", label: "品牌设置" }] },
  ];
}

export function adminNavSections() {
  return [
    {
      items: [
        { href: "/admin", label: "总览" },
        { href: "/admin/countries", label: "国家管理" },
        { href: "/admin/owners", label: "Owner 审核" },
      ],
    },
    {
      heading: "Bot 工具",
      items: [
        { href: "/dashboard/documents", label: "证件审核" },
        { href: "/dashboard/jobs", label: "任务监控" },
      ],
    },
  ];
}
