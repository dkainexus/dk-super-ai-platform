import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm, requireMerchantUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { buildPermissionMap } from "@/lib/rbac";
import { ErrorBanner } from "@/components/error-banner";
import { PermissionMatrix, DeleteRoleForm } from "@/components/roles-ui";
import type { Role } from "@/lib/types";

export default async function MerchantRoleEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const cu = await requireMerchantUser();
  await requirePerm("roles", "edit");
  const { id } = await params;
  const { error } = await searchParams;

  const { data } = await db().from("roles").select("*").eq("id", id).eq("merchant_id", cu.merchant.id).maybeSingle();
  if (!data) notFound();
  const role = data as Role;

  const { data: permRows } = await db().from("role_permissions").select("module, action, scope").eq("role_id", id);
  const perms = buildPermissionMap(permRows ?? []);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <Link href="/m/roles" className="text-xs text-muted hover:text-foreground">
            ← Team Roles
          </Link>
          <h1 className="mt-1 text-xl font-semibold">{role.name}</h1>
        </div>
        <DeleteRoleForm roleId={role.id} />
      </div>
      <ErrorBanner message={error} />
      <PermissionMatrix role={role} perms={perms} base="/m/roles" isMerchant />
    </div>
  );
}
