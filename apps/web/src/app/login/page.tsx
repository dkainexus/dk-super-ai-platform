/* eslint-disable @next/next/no-img-element */
import { redirect } from "next/navigation";
import { getCurrentUser, homePath } from "@/lib/auth";
import { tenantFromHost } from "@/lib/tenant";
import { platformSettings } from "@/lib/settings";
import { signedUrl, ASSETS_BUCKET } from "@/lib/storage";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage() {
  const cu = await getCurrentUser();
  if (cu) redirect(homePath(cu));

  // Tenant-branded login: on a merchant's subdomain / custom domain, show
  // that merchant's logo and name instead of the platform brand.
  const [tenant, platform] = await Promise.all([tenantFromHost(), platformSettings()]);
  const logoUrl = tenant ? await signedUrl(ASSETS_BUCKET, tenant.logo_path) : null;

  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
          ) : (
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
          )}
          <h1 className="text-2xl font-semibold tracking-tight">{tenant?.name ?? platform.name}</h1>
        </div>
        <div className="card glow-border p-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
