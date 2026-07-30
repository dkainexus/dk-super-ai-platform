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

// The platform door. On a white label's own domain this door doesn't exist —
// visitors are theirs, so they get the white label sign-in.
export default async function LoginPage() {
  const cu = await getCurrentUser();
  if (cu) redirect(homePath(cu));
  if (await tenantFromHost()) redirect("/m/login");

  return <LoginPageView audience="admin" subtitle="Platform back office" />;
}
