import Link from "next/link";
import { notFound } from "next/navigation";
/* eslint-disable @next/next/no-img-element */
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { signedUrl, ASSETS_BUCKET } from "@/lib/storage";
import {
  updateMerchantByAdmin,
  createMerchantUser,
  resetMerchantUserPassword,
  toggleMerchantUser,
  uploadMerchantLogoByAdmin,
} from "@/app/actions/cms";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag, OwnerStatusTag } from "@/components/status-tag";
import { SaveButton, SubmitButton } from "@/components/action-buttons";
import type { Country, Merchant, MerchantUser, Owner, OwnerStatus } from "@/lib/types";

export default async function MerchantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { error } = await searchParams;

  const { data } = await db()
    .from("merchants")
    .select("*, country:countries(*)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const m = data as Merchant & { country: Country };

  const [{ data: users }, { data: owners }, logoUrl] = await Promise.all([
    db().from("merchant_users").select("*").eq("merchant_id", id).order("created_at"),
    db().from("owners").select("*").eq("merchant_id", id).order("created_at", { ascending: false }),
    signedUrl(ASSETS_BUCKET, m.logo_path),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/admin/countries/${m.country_id}`} className="text-xs text-muted hover:text-foreground">
          ← {m.country?.flag} {m.country?.name}
        </Link>
        <div className="mt-1 flex items-center gap-3">
          {logoUrl && <img src={logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />}
          <h1 className="text-xl font-semibold">{m.name}</h1>
          <ActiveTag active={m.status === "active"} on="正常" off="已停用" />
        </div>
      </div>
      <ErrorBanner message={error} />

      {/* Merchant info */}
      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold">商家信息</h2>
        <form action={updateMerchantByAdmin} className="grid gap-4 sm:grid-cols-3 sm:items-end">
          <input type="hidden" name="id" value={m.id} />
          <div>
            <label className="mb-1 block text-xs text-muted">名称</label>
            <input name="name" defaultValue={m.name} className="input" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">子域名</label>
            <input name="subdomain" defaultValue={m.subdomain ?? ""} className="input mono-num" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">状态</label>
            <select name="status" defaultValue={m.status} className="input">
              <option value="active">正常</option>
              <option value="suspended">停用</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <SaveButton />
          </div>
        </form>
        <form action={uploadMerchantLogoByAdmin} className="mt-4 flex items-end gap-3 border-t border-border pt-4">
          <input type="hidden" name="id" value={m.id} />
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">Logo（≤2MB）</label>
            <input name="logo" type="file" accept="image/*" className="input" required />
          </div>
          <SubmitButton label="上传 Logo" variant="outline" />
        </form>
      </section>

      {/* Login accounts */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">登录账号</h2>
        <div className="space-y-3">
          {(users ?? []).map((u: MerchantUser) => (
            <div key={u.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="mono-num text-sm font-medium">{u.username}</p>
                <p className="text-xs text-muted">
                  {u.name || "—"} · {u.must_change_password ? "待首次改密" : "已激活"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ActiveTag active={u.active} />
                <form action={toggleMerchantUser}>
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="merchant_id" value={m.id} />
                  <input type="hidden" name="active" value={String(!u.active)} />
                  <button type="submit" className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-foreground">
                    {u.active ? "停用" : "启用"}
                  </button>
                </form>
                <form action={resetMerchantUserPassword} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="merchant_id" value={m.id} />
                  <input
                    name="password"
                    type="text"
                    placeholder="新密码"
                    autoComplete="off"
                    className="input w-28 py-1 text-xs"
                    required
                  />
                  <SubmitButton label="重置密码" variant="outline" />
                </form>
              </div>
            </div>
          ))}
        </div>

        <div className="card mt-4 p-5">
          <h3 className="mb-4 text-sm font-semibold">新增登录账号</h3>
          <form action={createMerchantUser} className="grid gap-4 sm:grid-cols-4 sm:items-end">
            <input type="hidden" name="merchant_id" value={m.id} />
            <div>
              <label className="mb-1 block text-xs text-muted">用户名</label>
              <input name="username" autoComplete="off" className="input mono-num" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">显示名（可选）</label>
              <input name="name" className="input" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">初始密码</label>
              <input name="password" type="text" autoComplete="off" className="input mono-num" required />
            </div>
            <SubmitButton label="创建账号" />
          </form>
        </div>
      </section>

      {/* Owners */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
          Owner（{(owners ?? []).length}）
        </h2>
        <div className="card divide-y divide-border">
          {(owners ?? []).length === 0 && <p className="px-5 py-6 text-sm text-muted">还没有 Owner。</p>}
          {(owners ?? []).map((o: Owner) => (
            <Link
              key={o.id}
              href={`/admin/owners/${o.id}`}
              className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-surface-raised"
            >
              <div>
                <p className="text-sm font-medium">{o.full_name || "（未填写姓名）"}</p>
                <p className="mono-num text-xs text-muted">{o.id_number || "—"}</p>
              </div>
              <OwnerStatusTag status={o.status as OwnerStatus} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
