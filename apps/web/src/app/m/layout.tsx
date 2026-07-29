import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireMerchantUser } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";
import { Shell } from "@/components/shell";

export async function generateMetadata(): Promise<Metadata> {
  const cu = await getCurrentUser();
  return { title: cu?.merchant?.name ?? "Portal" };
}

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const cu = await requireMerchantUser();
  // Customers have merchant accounts too, but their place is the portal.
  const { customerForUser } = await import("@/modules/customers/lib");
  if (await customerForUser(cu.user.id)) redirect("/portal");
  return <Shell cu={cu}>{children}</Shell>;
}
