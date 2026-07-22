import type { Metadata } from "next";
import { requirePlatformUser } from "@/lib/auth";
import { platformSettings } from "@/lib/settings";
import { Shell } from "@/components/shell";

export async function generateMetadata(): Promise<Metadata> {
  const platform = await platformSettings();
  return { title: platform.name };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cu = await requirePlatformUser();
  return <Shell cu={cu}>{children}</Shell>;
}
