import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { ErrorBanner } from "@/components/error-banner";
import { UserDetail, type UserRow } from "@/components/users-ui";
import type { Role } from "@/lib/types";

export default async function AdminUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("users", "view");
  const { id } = await params;
  const { error } = await searchParams;

  const [{ data: user }, { data: roles }] = await Promise.all([
    db().from("users").select("*, role:roles(*), merchant:merchants(*)").eq("id", id).maybeSingle(),
    db().from("roles").select("*").order("level").order("name"),
  ]);
  if (!user) notFound();
  const u = user as UserRow;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/users" className="text-xs text-muted hover:text-foreground">← Users</Link>
        <h1 className="mono-num mt-1 text-xl font-semibold">{u.username}</h1>
        <p className="mt-1 text-sm text-muted">{u.name || "—"} · {u.merchant?.name ?? "Platform"}</p>
      </div>
      <ErrorBanner message={error} />
      <UserDetail base="/admin/users" user={u} roles={(roles ?? []) as Role[]} selfId={cu.user.id} isSuper={cu.isSuper} />
    </div>
  );
}
