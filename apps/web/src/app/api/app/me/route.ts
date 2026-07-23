import { db } from "@/lib/supabase";
import { ownerFromRequest, unauthorized } from "@/lib/app-auth";
import { globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import { signedUrl, ASSETS_BUCKET } from "@/lib/storage";
import { unreadCount } from "@/modules/notifications/lib";

// GET /api/app/me → profile, branding and which app modules are enabled.
export async function GET(req: Request): Promise<Response> {
  const owner = await ownerFromRequest(req);
  if (!owner) return unauthorized();

  const [toggles, unread, bank] = await Promise.all([
    globalModuleToggles(),
    unreadCount(owner.id),
    owner.bank_id
      ? db().from("banks").select("name").eq("id", owner.bank_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const on = (key: string) => moduleEnabledFor(key, toggles, owner.merchant, owner.country);

  return Response.json({
    owner: {
      id: owner.id,
      name: owner.full_name,
      username: owner.app_username,
      status: owner.status,
      phone: owner.phone,
      email: owner.email,
      bank_name: (bank?.data as { name: string } | null)?.name ?? null,
      bank_account_no: owner.bank_account_no,
    },
    merchant: {
      name: owner.merchant.name,
      logo_url: await signedUrl(ASSETS_BUCKET, owner.merchant.logo_path, 3600),
    },
    country: {
      name: owner.country?.name ?? null,
      flag: owner.country?.flag ?? null,
      currency: owner.country?.currency ?? null,
    },
    unread_notifications: unread,
    modules: {
      training: on("training"),
      notifications: on("notifications"),
      exams: on("exams"),
      wallet: on("wallet"),
      bank_accounts: on("bank_accounts"),
    },
  });
}
