/* eslint-disable @next/next/no-img-element */
import { tenantFromHost } from "@/lib/tenant";
import { platformSettings } from "@/lib/settings";
import { signedUrl, ASSETS_BUCKET } from "@/lib/storage";
import { LoginForm } from "@/components/LoginForm";

/**
 * One look, three doors. The audience decides which kind of account the
 * form accepts; the brand comes from the tenant when there is one.
 */
export async function LoginPageView({
  audience,
  subtitle,
}: {
  audience: "admin" | "merchant" | "portal";
  subtitle: string;
}) {
  const [tenant, platform] = await Promise.all([tenantFromHost(), platformSettings()]);
  // The platform door always wears the platform brand; the other two wear
  // the white label's when they are entered through its domain.
  const brand = audience === "admin" ? null : tenant;
  const logoUrl = brand ? await signedUrl(ASSETS_BUCKET, brand.logo_path) : null;

  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-2 flex items-center justify-center gap-2.5">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
          ) : (
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
          )}
          <h1 className="text-2xl font-semibold tracking-tight">{brand?.name ?? platform.name}</h1>
        </div>
        <p className="mb-6 text-center text-sm text-muted">{subtitle}</p>
        <div className="card glow-border p-6">
          <LoginForm audience={audience} />
        </div>
      </div>
    </main>
  );
}
