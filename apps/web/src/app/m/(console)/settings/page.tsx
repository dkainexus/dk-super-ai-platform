/* eslint-disable @next/next/no-img-element */
import { requireMerchantUser, requirePerm } from "@/lib/auth";
import { signedUrl, ASSETS_BUCKET } from "@/lib/storage";
import { domainStatus, vercelEnabled } from "@/lib/vercel";
import { updateMerchantSettings, uploadMerchantLogo } from "@/modules/merchants/actions-merchant";
import { SubdomainField } from "@/modules/merchants/components/subdomain-field";
import { ErrorBanner } from "@/components/error-banner";
import { SaveButton, SubmitButton } from "@/components/action-buttons";

const APP_DOMAIN = "dkglobal.group";

async function CustomDomainStatus({ domain }: { domain: string }) {
  if (!vercelEnabled()) {
    return (
      <p className="mt-2 text-xs text-muted">
        Saved <span className="mono-num">{domain}</span>. Contact the administrator to finish the setup.
      </p>
    );
  }
  const st = await domainStatus(domain);
  if (!st) {
    return <p className="mt-2 text-xs text-warning">Domain status unavailable right now — refresh this page in a moment.</p>;
  }
  if (st.configured) {
    return (
      <div className="mt-2 rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
        ✅ Domain is live — your address:{" "}
        <a href={`https://${domain}`} target="_blank" rel="noreferrer" className="mono-num underline">
          https://{domain}
        </a>
      </div>
    );
  }
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
      <p className="font-medium text-warning">One step left: add this DNS record at your domain provider</p>
      <div className="overflow-x-auto">
        <table className="mono-num text-xs">
          <thead className="text-muted">
            <tr>
              <th className="pr-6 text-left">Type</th>
              <th className="pr-6 text-left">Host</th>
              <th className="text-left">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="pr-6 pt-1">{st.record.type}</td>
              <td className="pr-6 pt-1">{st.record.host}</td>
              <td className="pt-1">{st.record.value}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Usually takes minutes to a few hours. The HTTPS certificate is issued automatically. Refresh this page to see the ✅.
      </p>
    </div>
  );
}

/** The registrar walkthrough — visible before anything is saved, so the
 * partner knows exactly what handling their DNS records involves. */
function DomainGuide() {
  return (
    <details className="rounded-xl border border-border bg-surface-raised/40 px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium">How to connect your own domain</summary>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
        <li>
          Enter your domain above (e.g. <span className="mono-num">brand.com</span> or{" "}
          <span className="mono-num">portal.brand.com</span>) and press Save.
        </li>
        <li>
          Sign in at your domain provider (GoDaddy, Namecheap, Cloudflare…), open its DNS settings, and add the
          matching record:
          <div className="mt-2 overflow-x-auto">
            <table className="mono-num text-xs">
              <thead className="text-muted">
                <tr>
                  <th className="pr-6 text-left">You use…</th>
                  <th className="pr-6 text-left">Type</th>
                  <th className="pr-6 text-left">Host</th>
                  <th className="text-left">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="pr-6 pt-1">Root domain (brand.com)</td>
                  <td className="pr-6 pt-1">A</td>
                  <td className="pr-6 pt-1">@</td>
                  <td className="pt-1">76.76.21.21</td>
                </tr>
                <tr>
                  <td className="pr-6 pt-1">Subdomain (portal.brand.com)</td>
                  <td className="pr-6 pt-1">CNAME</td>
                  <td className="pr-6 pt-1">portal</td>
                  <td className="pt-1">cname.vercel-dns.com</td>
                </tr>
              </tbody>
            </table>
          </div>
        </li>
        <li>
          On Cloudflare, set the record to <span className="mono-num">DNS only</span> (grey cloud), not proxied.
        </li>
        <li>Come back here — the banner turns green when the domain is live; HTTPS is automatic.</li>
      </ol>
    </details>
  );
}

export default async function MerchantSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cu = await requireMerchantUser();
  await requirePerm("settings", "view");
  const merchant = cu.merchant;
  const { error } = await searchParams;
  const logoUrl = await signedUrl(ASSETS_BUCKET, merchant.logo_path);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted">Your brand, and where your console lives on the internet.</p>
      </div>
      <ErrorBanner message={error} />

      {/* ---------- Branding ---------- */}
      <section className="card p-6">
        <h2 className="mb-5 text-xs font-semibold uppercase tracking-wider text-muted">Branding</h2>
        <div className="flex flex-wrap items-start gap-6">
          <div className="shrink-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="logo"
                className="h-24 w-24 rounded-2xl object-cover shadow-[0_8px_24px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
              />
            ) : (
              <span className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-[#8b5cf6] text-3xl font-bold text-white shadow-[0_8px_24px_rgba(77,122,255,0.35)]">
                {merchant.name.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <form action={updateMerchantSettings} className="min-w-0 flex-1 space-y-4">
            <div>
              <label className="mb-1 block text-xs text-muted">Brand name</label>
              <input name="name" defaultValue={merchant.name} className="input text-base font-medium" required />
              <p className="mt-1 text-xs text-muted">Shown in the sidebar, your sign-in page and to your customers.</p>
            </div>

            <div className="border-t border-border pt-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Domains</h2>
              <SubdomainField defaultValue={merchant.subdomain ?? ""} suffix={APP_DOMAIN} />
              <div className="mt-3">
                <label className="mb-1 block text-xs text-muted">Custom domain (optional)</label>
                <input
                  name="custom_domain"
                  defaultValue={merchant.custom_domain ?? ""}
                  placeholder="brand.com"
                  className="input mono-num"
                />
                {merchant.custom_domain && <CustomDomainStatus domain={merchant.custom_domain} />}
              </div>
            </div>

            <SaveButton />
          </form>
        </div>

        <form action={uploadMerchantLogo} className="mt-5 flex items-end gap-3 border-t border-border pt-4">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">Change logo (≤2MB, square recommended)</label>
            <input name="logo" type="file" accept="image/*" className="input" required />
          </div>
          <SubmitButton label="Upload" variant="outline" />
        </form>

        <div className="mt-5">
          <DomainGuide />
        </div>
      </section>
    </div>
  );
}
