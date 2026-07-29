import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { ErrorBanner } from "@/components/error-banner";
import { UsersManager, type UserRow } from "@/components/users-ui";
import { FilterForm } from "@/components/filter-form";
import { FilterSelect } from "@/components/data-table";
import type { Merchant, Role } from "@/lib/types";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; merchant?: string; role?: string }>;
}) {
  const { cu } = await requirePerm("users", "view");
  const { error, merchant = "", role = "" } = await searchParams;

  let userQuery = db().from("users").select("*, role:roles(*), merchant:merchants(*)").order("username");
  // "Platform" is a real choice here, so an explicit filter of "platform" means
  // the accounts with no white label at all.
  if (merchant === "platform") userQuery = userQuery.is("merchant_id", null);
  else if (merchant) userQuery = userQuery.eq("merchant_id", merchant);
  if (role) userQuery = userQuery.eq("role_id", role);

  const [{ data: users }, { data: roles }, { data: merchants }] = await Promise.all([
    userQuery,
    db().from("roles").select("*").order("level").order("name"),
    db().from("merchants").select("*").eq("status", "active").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="mt-1 text-sm text-muted">Every account on the platform — filter by white label or role.</p>
      </div>
      <ErrorBanner message={error} />
      <UsersManager
        users={(users ?? []) as UserRow[]}
        roles={(roles ?? []) as Role[]}
        merchants={(merchants ?? []) as Merchant[]}
        isMerchant={false}
        selfId={cu.user.id}
        filters={
          <FilterForm action="/admin/users">
            <FilterSelect
              label="White Label"
              name="merchant"
              value={merchant}
              options={[
                { value: "", label: "All accounts" },
                { value: "platform", label: "Platform staff" },
                ...((merchants ?? []) as Merchant[]).map((m) => ({ value: m.id, label: m.name })),
              ]}
            />
            <FilterSelect
              label="Role"
              name="role"
              value={role}
              options={[
                { value: "", label: "All roles" },
                ...((roles ?? []) as Role[]).map((r) => ({
                  value: r.id,
                  label: `${r.name} (${r.level === "merchant" ? "white label" : r.level})`,
                })),
              ]}
            />
          </FilterForm>
        }
      />
    </div>
  );
}
