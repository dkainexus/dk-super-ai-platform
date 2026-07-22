import { requirePlatformUser } from "@/lib/auth";
import { Shell } from "@/components/shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cu = await requirePlatformUser();
  return <Shell cu={cu}>{children}</Shell>;
}
