import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm, requireMerchantUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { ErrorBanner } from "@/components/error-banner";
import { UserDetail, type UserRow } from "@/components/users-ui";
import { merchantCountries } from "@/modules/merchants/lib";
import { UserCountriesCard } from "@/modules/merchants/components/user-countries";
import type { Role } from "@/lib/types";

export default async function MerchantTeamMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const cu = await requireMerchantUser();
  await requirePerm("users", "view");
  const { id } = await params;
  const { error } = await searchParams;

  const [{ data: user }, { data: roles }, countries] = await Promise.all([
    db()
      .from("users")
      .select("*, role:roles(*), merchant:merchants(*)")
      .eq("id", id)
      .eq("merchant_id", cu.merchant.id)
      .maybeSingle(),
    db()
      .from("roles")
      .select("*")
      .eq("level", "merchant")
      .or(`merchant_id.eq.${cu.merchant.id},merchant_id.is.null`)
      .order("name"),
    merchantCountries(cu.merchant.id),
  ]);
  if (!user) notFound();
  const u = user as UserRow;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/team" className="text-xs text-muted hover:text-foreground">← Team</Link>
        <h1 className="mono-num mt-1 text-xl font-semibold">{u.username}</h1>
        <p className="mt-1 text-sm text-muted">{u.name || "—"} · {u.role?.name ?? "No role"}</p>
      </div>
      <ErrorBanner message={error} />
      <UserDetail base="/admin/team" user={u} roles={(roles ?? []) as Role[]} selfId={cu.user.id} isSuper={cu.isSuper} />
      <UserCountriesCard
        users={[{ id: u.id, username: u.username, name: u.name }]}
        countries={countries}
        back={`/m/team/${u.id}`}
      />
    </div>
  );
}
