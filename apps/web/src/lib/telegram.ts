import "server-only";

// Telegram Bot API helpers for the bot registry.

export type BotInfo = { id: number; username: string; first_name: string };

/** Validates a bot token against Telegram's getMe. */
export async function getBotInfo(token: string): Promise<{ ok: true; bot: BotInfo } | { ok: false; error: string }> {
  if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(token)) {
    return { ok: false, error: "That does not look like a bot token (format: 123456:ABC-...)" };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { cache: "no-store" });
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.description ?? "Telegram rejected this token" };
    return { ok: true, bot: data.result as BotInfo };
  } catch {
    return { ok: false, error: "Could not reach the Telegram API" };
  }
}

export function maskToken(token: string): string {
  return token.length > 14 ? `${token.slice(0, 10)}…${token.slice(-4)}` : "••••";
}
