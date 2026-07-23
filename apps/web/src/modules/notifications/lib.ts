import "server-only";
import { db } from "@/lib/supabase";
import type { NotificationType } from "@/lib/types";

/**
 * Push an in-app notification to one owner. Other modules call this on events
 * (company registered, reward granted, new training video, exam result…).
 */
export async function notifyOwner(
  ownerId: string,
  type: NotificationType,
  title: string,
  body?: string | null,
  createdBy?: string | null
): Promise<void> {
  await db().from("notifications").insert({
    owner_id: ownerId,
    type,
    title,
    body: body ?? null,
    created_by: createdBy ?? null,
  });
}

/** Same, fanned out to many owners at once. */
export async function notifyOwners(
  ownerIds: string[],
  type: NotificationType,
  title: string,
  body?: string | null,
  createdBy?: string | null
): Promise<number> {
  if (ownerIds.length === 0) return 0;
  const rows = ownerIds.map((owner_id) => ({
    owner_id,
    type,
    title,
    body: body ?? null,
    created_by: createdBy ?? null,
  }));
  const { error } = await db().from("notifications").insert(rows);
  return error ? 0 : rows.length;
}

/** Unread notification count for an owner (mobile app badge). */
export async function unreadCount(ownerId: string): Promise<number> {
  const { count } = await db()
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .is("read_at", null);
  return count ?? 0;
}
