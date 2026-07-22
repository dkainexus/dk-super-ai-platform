/* eslint-disable @next/next/no-img-element */
import { requireMerchant } from "@/lib/auth";
import { signedUrl, ASSETS_BUCKET } from "@/lib/storage";
import { updateMerchantSettings, uploadMerchantLogo } from "@/app/actions/merchant";
import { ErrorBanner } from "@/components/error-banner";
import { SaveButton, SubmitButton } from "@/components/action-buttons";

export default async function MerchantSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { merchant } = await requireMerchant();
  const { error } = await searchParams;
  const logoUrl = await signedUrl(ASSETS_BUCKET, merchant.logo_path);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">品牌设置</h1>
      <ErrorBanner message={error} />

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold">名称与域名</h2>
        <form action={updateMerchantSettings} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted">品牌名称</label>
            <input name="name" defaultValue={merchant.name} className="input" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">子域名（小写字母数字-）</label>
            <input name="subdomain" defaultValue={merchant.subdomain ?? ""} placeholder="my-brand" className="input mono-num" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted">自有域名（可选，绑定后需联系管理员配置解析）</label>
            <input name="custom_domain" defaultValue={merchant.custom_domain ?? ""} placeholder="example.com" className="input mono-num" />
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
            <label className="mb-1 block text-xs text-muted">上传新 Logo（≤2MB，建议正方形）</label>
            <input name="logo" type="file" accept="image/*" className="input" required />
          </div>
          <SubmitButton label="上传" variant="outline" />
        </form>
      </section>
    </div>
  );
}
