import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { ErrorBanner } from "@/components/error-banner";
import { UsersManager, type UserRow } from "@/components/users-ui";
import type { Merchant, Role } from "@/lib/types";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("users", "view");
  const { error } = await searchParams;

  const [{ data: users }, { data: roles }, { data: merchants }] = await Promise.all([
    db().from("users").select("*, role:roles(*), merchant:merchants(*)").order("created_at"),
    db().from("roles").select("*").order("level").order("name"),
    db().from("merchants").select("*").eq("status", "active").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="mt-1 text-sm text-muted">All accounts across the platform and merchants.</p>
      </div>
      <ErrorBanner message={error} />
      <UsersManager
        users={(users ?? []) as UserRow[]}
        roles={(roles ?? []) as Role[]}
        merchants={(merchants ?? []) as Merchant[]}
        isMerchant={false}
        selfId={cu.user.id}
      />
    </div>
  );
}
