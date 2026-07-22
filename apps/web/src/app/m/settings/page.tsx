/* eslint-disable @next/next/no-img-element */
import { requireMerchantUser, requirePerm } from "@/lib/auth";
import { signedUrl, ASSETS_BUCKET } from "@/lib/storage";
import { domainStatus, vercelEnabled } from "@/lib/vercel";
import { updateMerchantSettings, uploadMerchantLogo } from "@/app/actions/merchant";
import { ErrorBanner } from "@/components/error-banner";
import { SaveButton, SubmitButton } from "@/components/action-buttons";

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
        ✅ Domain is live — your address: 
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
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Branding</h1>
      <ErrorBanner message={error} />

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold">Name & Domain</h2>
        <form action={updateMerchantSettings} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted">Brand Name</label>
            <input name="name" defaultValue={merchant.name} className="input" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Subdomain (lowercase a-z 0-9 -)</label>
            <input name="subdomain" defaultValue={merchant.subdomain ?? ""} placeholder="my-brand" className="input mono-num" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted">
              Custom Domain (optional — enter your own domain and save; setup steps appear below)
            </label>
            <input name="custom_domain" defaultValue={merchant.custom_domain ?? ""} placeholder="example.com" className="input mono-num" />
            {merchant.custom_domain && <CustomDomainStatus domain={merchant.custom_domain} />}
          </div>
          <div className="sm:col-span-2">
            <SaveButton />
          </div>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold">Logo</h2>
        {logoUrl && <img src={logoUrl} alt="logo" className="mb-4 h-16 w-16 rounded-xl border border-border object-cover" />}
        <form action={uploadMerchantLogo} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">Upload New Logo (≤2MB, square recommended)</label>
            <input name="logo" type="file" accept="image/*" className="input" required />
          </div>
          <SubmitButton label="Upload" variant="outline" />
        </form>
      </section>
    </div>
  );
}
