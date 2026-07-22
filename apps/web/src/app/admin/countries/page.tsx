import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createCountry, toggleCountry } from "@/app/actions/cms";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { SubmitButton } from "@/components/action-buttons";
import type { Country } from "@/lib/types";

export default async function CountriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { error } = await searchParams;

  const { data: countries } = await db()
    .from("countries")
    .select("*, merchants(count), country_fields(count)")
    .order("sort")
    .order("created_at");

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">国家管理</h1>
      <p className="text-sm text-muted">
        点击国家进入后，可以创建商家账号、配置该国的 Owner 自定义字段。
      </p>
      <ErrorBanner message={error} />

      <div className="card divide-y divide-border">
        {(countries ?? []).length === 0 && (
          <p className="px-5 py-6 text-sm text-muted">还没有国家，用下面的表单创建第一个。</p>
        )}
        {(countries ?? []).map((c: Country & { merchants: { count: number }[]; country_fields: { count: number }[] }) => (
          <div key={c.id} className="flex items-center justify-between gap-4 px-5 py-4">
            <Link href={`/admin/countries/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 transition-colors hover:text-accent-strong">
              <span className="text-2xl">{c.flag || "🌐"}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {c.name} <span className="mono-num text-xs text-muted">{c.code}</span>
                </p>
                <p className="text-xs text-muted">
                  {c.merchants?.[0]?.count ?? 0} 个商家 · {c.country_fields?.[0]?.count ?? 0} 个自定义字段
                </p>
              </div>
            </Link>
            <div className="flex shrink-0 items-center gap-3">
              <ActiveTag active={c.active} />
              <form action={toggleCountry}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="active" value={String(!c.active)} />
                <button type="submit" className="rounded-md border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-foreground">
                  {c.active ? "停用" : "启用"}
                </button>
              </form>
              <Link
                href={`/admin/countries/${c.id}`}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-accent-strong"
              >
                进入管理 →
              </Link>
            </div>
          </div>
        ))}
      </div>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold">新增国家</h2>
        <form action={createCountry} className="grid gap-4 sm:grid-cols-[8rem_1fr_6rem_auto] sm:items-end">
          <div>
            <label className="mb-1 block text-xs text-muted">代码 (ISO)</label>
            <input name="code" placeholder="TH" maxLength={2} className="input mono-num uppercase" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">名称</label>
            <input name="name" placeholder="Thailand 泰国" className="input" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">旗帜 emoji</label>
            <input name="flag" placeholder="🇹🇭" className="input" />
          </div>
          <SubmitButton label="创建国家" />
        </form>
      </section>
    </div>
  );
}
