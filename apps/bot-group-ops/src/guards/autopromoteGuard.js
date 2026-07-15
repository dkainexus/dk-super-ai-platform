const { getDb, telegram: telegramHelpers, createLogger } = require("@dk/shared");

const log = createLogger("bot-group-ops");
const AUTHORIZED_ROLES = ["ceo", "coo", "director", "admin"];

async function findActiveStaff(telegramUserId) {
  const db = getDb();
  const { data, error } = await db
    .from("staff")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function anyStaffExists() {
  const db = getDb();
  const { count, error } = await db
    .from("staff")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return (count || 0) > 0;
}

// Security guard: if the bot is added to a new group by someone who is not
// an authorized staff member, leave immediately (skipped only during the
// bootstrap window before any staff row exists at all).
function registerAutopromoteGuard(bot) {
  bot.on("my_chat_member", async (ctx) => {
    const update = ctx.myChatMember;
    const botBecameMember = ["member", "administrator"].includes(
      update.new_chat_member.status
    );
    if (!botBecameMember) return;

    const bootstrapping = !(await anyStaffExists());
    if (bootstrapping) return;

    const adder = await findActiveStaff(update.from.id);
    const authorized = adder && AUTHORIZED_ROLES.includes(adder.role);
    if (!authorized) {
      log.warn(
        `unauthorized add to chat ${update.chat.id} by ${update.from.id}, leaving`
      );
      await ctx.leaveChat();
    }
  });

  // When an authorized staff member joins a group the bot is already in,
  // auto-promote them to Telegram chat-admin with a fixed rights set.
  bot.on("chat_member", async (ctx) => {
    const update = ctx.chatMember;
    const justJoined =
      update.new_chat_member.status === "member" &&
      ["left", "kicked"].includes(update.old_chat_member.status);
    if (!justJoined) return;

    const staffMember = await findActiveStaff(update.new_chat_member.user.id);
    if (!staffMember || !AUTHORIZED_ROLES.includes(staffMember.role)) return;

    try {
      await telegramHelpers.promoteStaffMember(
        ctx.telegram,
        update.chat.id,
        update.new_chat_member.user.id
      );
    } catch (err) {
      log.error("failed to auto-promote staff member:", err.message);
    }
  });
}

module.exports = { registerAutopromoteGuard };
