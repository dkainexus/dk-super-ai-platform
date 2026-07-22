/* eslint-disable @next/next/no-img-element */
import { redirect } from "next/navigation";
import { getSessionUser, homePath } from "@/lib/auth";
import { tenantFromHost } from "@/lib/tenant";
import { signedUrl, ASSETS_BUCKET } from "@/lib/storage";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage() {
  const su = await getSessionUser();
  if (su) redirect(homePath(su));

  // Tenant-branded login: on a merchant's subdomain / custom domain, show
  // that merchant's logo and name instead of the platform brand.
  const tenant = await tenantFromHost();
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
          <h1 className="text-2xl font-semibold tracking-tight">{tenant?.name ?? "DK CMS"}</h1>
        </div>
        <div className="card glow-border p-6">
          <LoginForm />
        </div>
        {!tenant && <p className="mt-4 text-center text-xs text-muted">管理员与商家使用同一入口登录</p>}
      </div>
    </main>
  );
}
