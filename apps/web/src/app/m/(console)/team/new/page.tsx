import Link from "next/link";
import { requirePerm, requireMerchantUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { ErrorBanner } from "@/components/error-banner";
import { UserCreateForm } from "@/components/users-ui";
import type { Role } from "@/lib/types";

export default async function MerchantNewMemberPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cu = await requireMerchantUser();
  await requirePerm("users", "add");
  const { error } = await searchParams;

  const { data: roles } = await db()
    .from("roles")
    .select("*")
    .eq("level", "merchant")
    .or(`merchant_id.eq.${cu.merchant.id},merchant_id.is.null`)
    .order("name");

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/team" className="text-xs text-muted hover:text-foreground">← Team</Link>
        <h1 className="mt-1 text-xl font-semibold">New Member</h1>
        <p className="mt-1 text-sm text-muted">They choose their own password at first sign-in.</p>
      </div>
      <ErrorBanner message={error} />
      <UserCreateForm base="/admin/team" isMerchant roles={(roles ?? []) as Role[]} merchants={[]} />
    </div>
  );
}
