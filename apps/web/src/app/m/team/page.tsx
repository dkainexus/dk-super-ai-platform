import { requirePerm, requireMerchantUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { ErrorBanner } from "@/components/error-banner";
import { UsersManager, type UserRow } from "@/components/users-ui";
import type { Role } from "@/lib/types";

export default async function MerchantTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cu = await requireMerchantUser();
  await requirePerm("users", "view");
  const { error } = await searchParams;

  const [{ data: users }, { data: roles }] = await Promise.all([
    db()
      .from("users")
      .select("*, role:roles(*), merchant:merchants(*)")
      .eq("merchant_id", cu.merchant.id)
      .order("created_at"),
    db()
      .from("roles")
      .select("*")
      .eq("level", "merchant")
      .or(`merchant_id.eq.${cu.merchant.id},merchant_id.is.null`)
      .order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Team</h1>
        <p className="mt-1 text-sm text-muted">Your team members and their roles.</p>
      </div>
      <ErrorBanner message={error} />
      <UsersManager
        users={(users ?? []) as UserRow[]}
        roles={(roles ?? []) as Role[]}
        merchants={[]}
        isMerchant
        selfId={cu.user.id}
      />
    </div>
  );
}
