import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { tenantFromHost } from "@/lib/tenant";
import { platformSettings } from "@/lib/settings";
import { LoginPageView } from "@/components/login-page";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const [tenant, platform] = await Promise.all([tenantFromHost(), platformSettings()]);
  return { title: `Sign in — ${tenant?.name ?? platform.name}` };
}

// The white label door: their team and their agents.
export default async function MerchantLoginPage() {
  const cu = await getCurrentUser();
  if (cu) redirect(cu.merchant ? "/m" : "/admin");

  return <LoginPageView audience="merchant" subtitle="White label console" />;
}
