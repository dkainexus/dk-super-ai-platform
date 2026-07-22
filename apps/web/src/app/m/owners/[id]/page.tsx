import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMerchant } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { env } from "@/lib/env";
import { submitOwnerForReview, deleteOwner, generateOwnerInvite } from "@/app/actions/merchant";
import { CopyField } from "@/components/copy-field";
import { ErrorBanner } from "@/components/error-banner";
import { OwnerStatusTag } from "@/components/status-tag";
import { SubmitButton } from "@/components/action-buttons";
import { OwnerForm } from "@/components/owner-form";
import type { CountryField, Owner, OwnerFieldValue } from "@/lib/types";

export default async function MerchantOwnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { merchant } = await requireMerchant();
  const { id } = await params;
  const { error } = await searchParams;

  const { data } = await db()
    .from("owners")
    .select("*")
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .maybeSingle();
  if (!data) notFound();
  const owner = data as Owner;

  const [{ data: fields }, { data: values }] = await Promise.all([
    db()
      .from("country_fields")
      .select("*")
      .eq("country_id", merchant.country_id)
      .eq("active", true)
      .order("sort"),
    db().from("owner_field_values").select("*").eq("owner_id", owner.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/m/owners" className="text-xs text-muted hover:text-foreground">
          ← Owner 管理
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{owner.full_name || "（未填写姓名）"}</h1>
          <OwnerStatusTag status={owner.status} />
        </div>
      </div>
      <ErrorBanner message={error} />

      {owner.status === "rejected" && owner.reject_reason && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger">
          审核未通过:{owner.reject_reason} — 修改资料后可重新提交。
        </div>
      )}
      {owner.status === "pending" && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm text-warning">
          已提交审核,等待管理员处理。审核期间仍可修改资料。
        </div>
      )}

      {/* Telegram intake */}
      <section className="card p-5">
        <h2 className="mb-2 text-sm font-semibold">Telegram 收集资料</h2>
        {owner.telegram_user_id ? (
          <p className="text-sm text-muted">
            ✅ 已绑定 Telegram（<span className="mono-num">{owner.telegram_user_id}</span>），Owner
            可直接在 bot 对话里继续补交资料。
          </p>
        ) : owner.invite_token && owner.invite_expires_at && new Date(owner.invite_expires_at) > new Date() ? (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              把这条链接发给 Owner，点开后 bot 会一步步收集资料（7 天有效，重新生成会使旧链接失效）：
            </p>
            <CopyField value={`https://t.me/${env.onboardingBotUsername()}?start=${owner.invite_token}`} />
          </div>
        ) : (
          <p className="text-sm text-muted">还没有邀请链接。生成后发给 Owner，资料由 Telegram bot 自动收集。</p>
        )}
        {owner.status !== "approved" && owner.status !== "pending" && (
          <form action={generateOwnerInvite} className="mt-3">
            <input type="hidden" name="id" value={owner.id} />
            <SubmitButton label={owner.invite_token ? "重新生成邀请链接" : "生成邀请链接"} variant="outline" />
          </form>
        )}
      </section>

      <div className="card p-5">
        <OwnerForm
          fields={(fields ?? []) as CountryField[]}
          owner={owner}
          values={(values ?? []) as OwnerFieldValue[]}
        />
      </div>

      {owner.status !== "approved" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {owner.status !== "pending" ? (
            <form action={submitOwnerForReview}>
              <input type="hidden" name="id" value={owner.id} />
              <SubmitButton label="提交审核" />
            </form>
          ) : (
            <span />
          )}
          <form action={deleteOwner}>
            <input type="hidden" name="id" value={owner.id} />
            <SubmitButton label="删除 Owner" variant="danger" />
          </form>
        </div>
      )}
    </div>
  );
}
