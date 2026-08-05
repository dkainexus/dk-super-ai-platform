import { requirePerm, requireMerchantUser, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { UsersList, type UserRow } from "@/components/users-ui";
import { FilterForm, SearchInput } from "@/components/filter-form";
import { FilterSelect } from "@/components/data-table";
import { Pagination, pageParams } from "@/components/pagination";
import type { Role } from "@/lib/types";

export default async function MerchantTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; role?: string; q?: string; page?: string; per?: string }>;
}) {
  const cu = await requireMerchantUser();
  await requirePerm("users", "view");
  const sp = await searchParams;
  const { error, role = "", q = "" } = sp;
  const { page, perPage, from, to } = pageParams(sp);

  let userQuery = db()
    .from("users")
    .select("*, role:roles(*), merchant:merchants(*)", { count: "exact" })
    .eq("merchant_id", cu.merchant.id)
    .order("username");
  if (role) userQuery = userQuery.eq("role_id", role);
  if (q.trim()) {
    const needle = q.trim().replace(/[,()%]/g, "");
    userQuery = userQuery.or(`username.ilike.%${needle}%,name.ilike.%${needle}%`);
  }

  const [{ data: users, count }, { data: roles }] = await Promise.all([
    userQuery.range(from, to),
    db()
      .from("roles")
      .select("*")
      .eq("level", "merchant")
      .or(`merchant_id.eq.${cu.merchant.id},merchant_id.is.null`)
      .order("name"),
  ]);
  const total = count ?? (users ?? []).length;

  return (
    <UsersList
      base="/admin/team"
      title="Team"
      subtitle="Your team members and their roles."
      noun="Member"
      rows={(users ?? []) as UserRow[]}
      total={total}
      isMerchant
      canAdd={Boolean(can(cu, "users", "add"))}
      error={error}
      filters={
        <FilterForm action="/admin/team">
          <SearchInput placeholder="Search username or name…" defaultValue={q} />
          <FilterSelect
            label="Role"
            name="role"
            value={role}
            options={[
              { value: "", label: "All roles" },
              ...((roles ?? []) as Role[]).map((r) => ({ value: r.id, label: r.name })),
            ]}
          />
        </FilterForm>
      }
      pagination={
        <Pagination basePath="/admin/team" params={{ role, q }} page={page} perPage={perPage} total={total} />
      }
    />
  );
}
