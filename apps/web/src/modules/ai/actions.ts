"use server";

// AI Assistant module actions.

import { redirect } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { setSetting } from "@/lib/settings";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

/** AI Assistant provider config. Blank key fields keep the stored key. */
export async function saveAiSettings(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("settings", "edit");
  if (cu.merchant) redirect("/m");
  const { aiSettings } = await import("./lib");
  const current = await aiSettings();

  const provider = String(formData.get("provider") ?? "claude");
  if (provider !== "claude" && provider !== "chatgpt") fail("/admin/settings/ai", "Unknown provider");

  const claudeKey = String(formData.get("claude_api_key") ?? "").trim();
  const chatgptKey = String(formData.get("chatgpt_api_key") ?? "").trim();

  await setSetting("ai", {
    provider,
    claude_api_key: claudeKey || current.claude_api_key,
    claude_model: String(formData.get("claude_model") ?? current.claude_model),
    chatgpt_api_key: chatgptKey || current.chatgpt_api_key,
    chatgpt_model: String(formData.get("chatgpt_model") ?? current.chatgpt_model),
  });
  redirect("/admin/settings/ai?saved=1");
}

/** Remove a stored API key ("claude" | "chatgpt"). */
export async function clearAiKey(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("settings", "edit");
  if (cu.merchant) redirect("/m");
  const { aiSettings } = await import("./lib");
  const current = await aiSettings();
  const which = String(formData.get("which") ?? "");
  if (which === "claude") current.claude_api_key = "";
  if (which === "chatgpt") current.chatgpt_api_key = "";
  await setSetting("ai", current);
  redirect("/admin/settings/ai");
}

