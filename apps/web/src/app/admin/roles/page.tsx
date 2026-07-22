import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { ErrorBanner } from "@/components/error-banner";
import { RoleList } from "@/components/roles-ui";
import type { Role } from "@/lib/types";

export default async function AdminRolesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePerm("roles", "view");
  const { error } = await searchParams;

  const [{ data: roles }, { data: counts }] = await Promise.all([
    db().from("roles").select("*").is("merchant_id", null).order("level").order("created_at"),
    db().from("users").select("role_id"),
  ]);
  const userCounts = new Map<string, number>();
  for (const u of counts ?? []) {
    if (u.role_id) userCounts.set(u.role_id, (userCounts.get(u.role_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Roles</h1>
        <p className="mt-1 text-sm text-muted">
          Create roles and grant per-module permissions. Merchant-level roles can be assigned to merchant users.
        </p>
      </div>
      <ErrorBanner message={error} />
      <RoleList roles={(roles ?? []) as Role[]} base="/admin/roles" isMerchant={false} userCounts={userCounts} />
    </div>
  );
}
