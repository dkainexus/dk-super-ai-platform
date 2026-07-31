import { redirect } from "next/navigation";
import { getCurrentUser, homePath } from "@/lib/auth";
import { tenantFromHost } from "@/lib/tenant";
import { platformSettings } from "@/lib/settings";
import { LoginPageView } from "@/components/login-page";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const platform = await platformSettings();
  return { title: `Sign in — ${platform.name}` };
}

// The one door. On a white label's own domain it wears their brand; the
// account decides where you land after.
export default async function LoginPage() {
  const cu = await getCurrentUser();
  if (cu) redirect(homePath(cu));
  const tenant = await tenantFromHost();

  return <LoginPageView audience="admin" subtitle={tenant ? "Console sign-in" : "Sign in"} />;
}
