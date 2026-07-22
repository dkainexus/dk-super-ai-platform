/* eslint-disable @next/next/no-img-element */
import { requireMerchant } from "@/lib/auth";
import { signedUrl, ASSETS_BUCKET } from "@/lib/storage";
import { domainStatus, vercelEnabled } from "@/lib/vercel";
import { updateMerchantSettings, uploadMerchantLogo } from "@/app/actions/merchant";
import { ErrorBanner } from "@/components/error-banner";
import { SaveButton, SubmitButton } from "@/components/action-buttons";

async function CustomDomainStatus({ domain }: { domain: string }) {
  if (!vercelEnabled()) {
    return (
      <p className="mt-2 text-xs text-muted">
        已保存 <span className="mono-num">{domain}</span>，请联系管理员完成接入。
      </p>
    );
  }
  const st = await domainStatus(domain);
  if (!st) {
    return <p className="mt-2 text-xs text-warning">暂时查询不到域名状态，稍后刷新本页再看。</p>;
  }
  if (st.configured) {
    return (
      <div className="mt-2 rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
        ✅ 域名已生效 —— 你的专属地址：
        <a href={`https://${domain}`} target="_blank" rel="noreferrer" className="mono-num underline">
          https://{domain}
        </a>
      </div>
    );
  }
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
      <p className="font-medium text-warning">还差一步：到你的域名服务商（DNS 管理）添加下面这条解析记录</p>
      <div className="overflow-x-auto">
        <table className="mono-num text-xs">
          <thead className="text-muted">
            <tr>
              <th className="pr-6 text-left">类型</th>
              <th className="pr-6 text-left">主机记录 (Host)</th>
              <th className="text-left">记录值 (Value)</th>
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
        添加后一般几分钟到几小时生效，HTTPS 证书会自动配置。生效后刷新本页即可看到 ✅。
      </p>
    </div>
  );
}

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
            <label className="mb-1 block text-xs text-muted">
              自有域名（可选 —— 填入你自己的域名并保存，下方会显示配置步骤）
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
            <label className="mb-1 block text-xs text-muted">上传新 Logo（≤2MB，建议正方形）</label>
            <input name="logo" type="file" accept="image/*" className="input" required />
          </div>
          <SubmitButton label="上传" variant="outline" />
        </form>
      </section>
    </div>
  );
}
