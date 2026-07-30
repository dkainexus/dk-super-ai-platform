import type { ModuleDef } from "@/modules/registry";

export const shippingModule: ModuleDef = {
  key: "shipping",
  name: "Shipping",
  description: "Everything that leaves the building: what to send, what's in transit, what arrived",
  adminNav: { href: "/admin/shipping", label: "Shipping" },
};
