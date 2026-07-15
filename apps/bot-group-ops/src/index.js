require("dotenv").config();
const { Telegraf } = require("telegraf");
const { startWorker, createLogger } = require("@dk/shared");
const { registerAutopromoteGuard } = require("./guards/autopromoteGuard");
const { createTopicHandler } = require("./jobs/createTopic");
const { setAvatarHandler } = require("./jobs/setAvatar");
const { renameGroupHandler } = require("./jobs/renameGroup");
const { promoteAdminHandler } = require("./jobs/promoteAdmin");

const log = createLogger("bot-group-ops");

if (!process.env.BOT_TOKEN_GROUP_OPS) {
  throw new Error("BOT_TOKEN_GROUP_OPS is required");
}

const bot = new Telegraf(process.env.BOT_TOKEN_GROUP_OPS);

bot.catch((err, ctx) => {
  log.error(`unhandled error for update ${ctx.update.update_id}:`, err);
});

bot.command("whoami", (ctx) =>
  ctx.reply(`user_id: ${ctx.from.id}\nchat_id: ${ctx.chat.id}`)
);

registerAutopromoteGuard(bot);

const stopWorker = startWorker(
  "group_ops",
  {
    "group.create_topic": createTopicHandler(bot.telegram),
    "group.set_avatar": setAvatarHandler(bot.telegram),
    "group.rename": renameGroupHandler(bot.telegram),
    "group.promote_admin": promoteAdminHandler(bot.telegram),
  },
  { intervalMs: 7000 }
);

bot
  .launch({ allowedUpdates: ["message", "chat_member", "my_chat_member"] })
  .then(() => log.info("bot-group-ops launched"));

process.once("SIGINT", () => {
  stopWorker();
  bot.stop("SIGINT");
});
process.once("SIGTERM", () => {
  stopWorker();
  bot.stop("SIGTERM");
});
