import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { tenantFromHost } from "@/lib/tenant";
import { platformSettings } from "@/lib/settings";
import { LoginPageView } from "@/components/login-page";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const [tenant, platform] = await Promise.all([tenantFromHost(), platformSettings()]);
  return { title: `Customer sign in — ${tenant?.name ?? platform.name}` };
}

// The customer door.
export default async function PortalLoginPage() {
  const cu = await getCurrentUser();
  if (cu) redirect("/portal");

  return <LoginPageView audience="portal" subtitle="Customer portal" />;
}
