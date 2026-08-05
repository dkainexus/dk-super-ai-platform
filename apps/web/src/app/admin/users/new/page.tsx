import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { ErrorBanner } from "@/components/error-banner";
import { UserCreateForm } from "@/components/users-ui";
import type { Merchant, Role } from "@/lib/types";

export default async function AdminNewUserPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePerm("users", "add");
  const { error } = await searchParams;

  const [{ data: roles }, { data: merchants }] = await Promise.all([
    db().from("roles").select("*").order("level").order("name"),
    db().from("merchants").select("*").eq("status", "active").order("name"),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/users" className="text-xs text-muted hover:text-foreground">← Users</Link>
        <h1 className="mt-1 text-xl font-semibold">New User</h1>
        <p className="mt-1 text-sm text-muted">They choose their own password at first sign-in.</p>
      </div>
      <ErrorBanner message={error} />
      <UserCreateForm
        base="/admin/users"
        isMerchant={false}
        roles={(roles ?? []) as Role[]}
        merchants={(merchants ?? []) as Merchant[]}
      />
    </div>
  );
}
