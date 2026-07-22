import type { Metadata } from "next";
import { requireMerchantUser } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";
import { Shell } from "@/components/shell";

export async function generateMetadata(): Promise<Metadata> {
  const cu = await getCurrentUser();
  return { title: cu?.merchant?.name ?? "Portal" };
}

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const cu = await requireMerchantUser();
  return <Shell cu={cu}>{children}</Shell>;
}
