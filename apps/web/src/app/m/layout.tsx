import { requireMerchantUser } from "@/lib/auth";
import { Shell } from "@/components/shell";

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const cu = await requireMerchantUser();
  return <Shell cu={cu}>{children}</Shell>;
}
