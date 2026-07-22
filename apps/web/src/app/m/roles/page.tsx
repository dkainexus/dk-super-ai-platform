import { requirePerm, requireMerchantUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { ErrorBanner } from "@/components/error-banner";
import { RoleList } from "@/components/roles-ui";
import type { Role } from "@/lib/types";

export default async function MerchantRolesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cu = await requireMerchantUser();
  await requirePerm("roles", "view");
  const { error } = await searchParams;

  const [{ data: roles }, { data: counts }] = await Promise.all([
    db()
      .from("roles")
      .select("*")
      .eq("level", "merchant")
      .or(`merchant_id.eq.${cu.merchant.id},merchant_id.is.null`)
      .order("created_at"),
    db().from("users").select("role_id").eq("merchant_id", cu.merchant.id),
  ]);
  const userCounts = new Map<string, number>();
  for (const u of counts ?? []) {
    if (u.role_id) userCounts.set(u.role_id, (userCounts.get(u.role_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Team Roles</h1>
        <p className="mt-1 text-sm text-muted">Create roles for your team members and control what they can do.</p>
      </div>
      <ErrorBanner message={error} />
      <RoleList roles={(roles ?? []) as Role[]} base="/m/roles" isMerchant userCounts={userCounts} />
    </div>
  );
}
