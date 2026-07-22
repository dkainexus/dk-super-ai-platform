"use server";

// Telegram Bot module actions.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { getBotInfo } from "./lib";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

// ---------- Telegram module (shared bot registry) ----------

export async function createTelegramBot(formData: FormData): Promise<void> {
  await requirePerm("telegram", "add");
  const back = "/admin/telegram";
  const name = String(formData.get("name") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();
  if (!token) fail(back, "Please paste the bot token");

  const check = await getBotInfo(token);
  if (!check.ok) fail(back, `Token check failed: ${check.error}`);

  const { error } = await db().from("telegram_bots").insert({
    name: name || check.bot.first_name,
    token,
    bot_username: check.bot.username,
    last_check_ok: true,
    last_check_at: new Date().toISOString(),
  });
  if (error) fail(back, error.message.includes("duplicate") ? "This bot token is already registered" : `Failed to add: ${error.message}`);
  revalidatePath(back);
  redirect(back);
}

export async function updateTelegramBot(formData: FormData): Promise<void> {
  await requirePerm("telegram", "edit");
  const back = "/admin/telegram";
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const active = formData.get("active") === "on";
  if (!name) fail(back, "Bot name cannot be empty");
  await db().from("telegram_bots").update({ name, note, active }).eq("id", id);
  revalidatePath(back);
  redirect(back);
}

/** Re-runs getMe for a bot and stores the health result. */
export async function verifyTelegramBot(formData: FormData): Promise<void> {
  await requirePerm("telegram", "view");
  const back = "/admin/telegram";
  const id = String(formData.get("id") ?? "");
  const { data } = await db().from("telegram_bots").select("token").eq("id", id).maybeSingle();
  if (!data) fail(back, "Bot not found");

  const check = await getBotInfo(data.token);
  await db()
    .from("telegram_bots")
    .update({
      last_check_ok: check.ok,
      last_check_at: new Date().toISOString(),
      ...(check.ok ? { bot_username: check.bot.username } : {}),
    })
    .eq("id", id);
  revalidatePath(back);
  redirect(check.ok ? back : `${back}?error=${encodeURIComponent(`Health check failed: ${(check as { error: string }).error}`)}`);
}

export async function deleteTelegramBot(formData: FormData): Promise<void> {
  await requirePerm("telegram", "delete");
  const id = String(formData.get("id") ?? "");
  await db().from("telegram_bots").delete().eq("id", id);
  revalidatePath("/admin/telegram");
  redirect("/admin/telegram");
}
