import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import {
  createCountryField,
  updateCountryField,
  deleteCountryField,
  createMerchant,
} from "@/app/actions/cms";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { SaveButton, SubmitButton } from "@/components/action-buttons";
import type { Country, CountryField, Merchant } from "@/lib/types";

const FIELD_TYPE_LABEL: Record<string, string> = {
  text: "文字",
  number: "数字",
  date: "日期",
  file: "文件上传",
  select: "下拉选择",
};

export default async function CountryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { error } = await searchParams;

  const { data: country } = await db().from("countries").select("*").eq("id", id).maybeSingle();
  if (!country) notFound();
  const c = country as Country;

  const [{ data: merchants }, { data: fields }] = await Promise.all([
    db()
      .from("merchants")
      .select("*, merchant_users(count), owners(count)")
      .eq("country_id", id)
      .order("created_at"),
    db().from("country_fields").select("*").eq("country_id", id).order("sort"),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/countries" className="text-xs text-muted hover:text-foreground">
          ← 国家管理
        </Link>
        <h1 className="mt-1 text-xl font-semibold">
          {c.flag || "🌐"} {c.name} <span className="mono-num text-sm text-muted">{c.code}</span>
        </h1>
      </div>
      <ErrorBanner message={error} />

      {/* ---------- Merchants ---------- */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">商家</h2>
        <div className="card divide-y divide-border">
          {(merchants ?? []).length === 0 && (
            <p className="px-5 py-6 text-sm text-muted">这个国家还没有商家。</p>
          )}
          {(merchants ?? []).map(
            (m: Merchant & { merchant_users: { count: number }[]; owners: { count: number }[] }) => (
              <Link
                key={m.id}
                href={`/admin/merchants/${m.id}`}
                className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-surface-raised"
              >
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted">
                    {m.subdomain ? `${m.subdomain}.***` : "未设置子域名"} · {m.merchant_users?.[0]?.count ?? 0} 个账号 ·{" "}
                    {m.owners?.[0]?.count ?? 0} 个 Owner
                  </p>
                </div>
                <ActiveTag active={m.status === "active"} on="正常" off="已停用" />
              </Link>
            )
          )}
        </div>

        <div className="card mt-4 p-5">
          <h3 className="mb-4 text-sm font-semibold">创建商家 + 登录账号</h3>
          <form action={createMerchant} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="country_id" value={c.id} />
            <div>
              <label className="mb-1 block text-xs text-muted">商家名称</label>
              <input name="name" className="input" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">子域名（可选，小写字母数字-）</label>
              <input name="subdomain" placeholder="merchant-a" className="input mono-num" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">登录用户名</label>
              <input name="username" autoComplete="off" className="input mono-num" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">初始密码（首次登录强制修改）</label>
              <input name="password" type="text" autoComplete="off" className="input mono-num" required />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton label="创建商家" />
            </div>
          </form>
        </div>
      </section>

      {/* ---------- Custom fields ---------- */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
          Owner 自定义字段（仅 {c.name} 生效）
        </h2>
        <p className="mb-3 text-xs text-muted">
          内置字段：姓名、ID 号码、ID 正面、ID 背面。这里添加的字段会自动出现在该国所有商家的 Owner 表单里，例如泰国的
          Tabien Baan。
        </p>
        <div className="space-y-3">
          {(fields ?? []).map((f: CountryField) => (
            <div key={f.id} className="card p-4">
              <form action={updateCountryField} className="grid items-end gap-3 sm:grid-cols-[1fr_7rem_5rem_5rem_auto_auto]">
                <input type="hidden" name="id" value={f.id} />
                <input type="hidden" name="country_id" value={c.id} />
                <div>
                  <label className="mb-1 block text-xs text-muted">
                    名称 <span className="mono-num">({f.field_key} · {FIELD_TYPE_LABEL[f.field_type]})</span>
                  </label>
                  <input name="label" defaultValue={f.label} className="input" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">排序</label>
                  <input name="sort" type="number" defaultValue={f.sort} className="input mono-num" />
                </div>
                <label className="flex items-center gap-2 pb-2 text-xs text-muted">
                  <input type="checkbox" name="required" defaultChecked={f.required} /> 必填
                </label>
                <label className="flex items-center gap-2 pb-2 text-xs text-muted">
                  <input type="checkbox" name="active" defaultChecked={f.active} /> 启用
                </label>
                <SaveButton />
                <button
                  type="submit"
                  formAction={deleteCountryField}
                  className="rounded-md border border-danger/40 px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10"
                >
                  删除
                </button>
              </form>
              {f.field_type === "select" && (
                <p className="mt-2 text-xs text-muted">选项：{(f.options ?? []).join(" / ")}</p>
              )}
            </div>
          ))}
        </div>

        <div className="card mt-4 p-5">
          <h3 className="mb-4 text-sm font-semibold">新增字段</h3>
          <form action={createCountryField} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="country_id" value={c.id} />
            <div>
              <label className="mb-1 block text-xs text-muted">字段名称（显示给商家）</label>
              <input name="label" placeholder="Tabien Baan 户口本" className="input" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">字段 key（可选，留空自动生成）</label>
              <input name="field_key" placeholder="tabien_baan" className="input mono-num" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">类型</label>
              <select name="field_type" className="input">
                <option value="text">文字</option>
                <option value="number">数字</option>
                <option value="date">日期</option>
                <option value="file">文件上传</option>
                <option value="select">下拉选择</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">下拉选项（仅下拉类型，逗号分隔）</label>
              <input name="options" placeholder="选项A, 选项B" className="input" />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" name="required" /> 必填字段
            </label>
            <div className="sm:col-span-2">
              <SubmitButton label="添加字段" />
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
