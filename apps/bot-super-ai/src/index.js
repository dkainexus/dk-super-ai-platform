require("dotenv").config();
const { Telegraf } = require("telegraf");
const { heartbeat, createLogger } = require("@dk/shared");
const { findActiveStaff, canActOnBehalfOfBots } = require("./staffGate");
const { runBrain } = require("./brain");
const { definitions } = require("./tools");

const log = createLogger("bot-super-ai");

if (!process.env.BOT_TOKEN_SUPER_AI) {
  throw new Error("BOT_TOKEN_SUPER_AI is required");
}

const bot = new Telegraf(process.env.BOT_TOKEN_SUPER_AI);
// Per-user last-sent photo, so a follow-up instruction ("change avatar to
// this") can reference the file_id without re-uploading. Not persisted —
// this bot has no other reason to remember state across restarts.
const lastPhotoByUser = new Map();

bot.catch((err, ctx) => {
  log.error(`unhandled error for update ${ctx.update.update_id}:`, err);
});

function isDirectMessage(ctx) {
  return ctx.chat?.type === "private";
}

bot.command("whoami", (ctx) =>
  ctx.reply(`user_id: ${ctx.from.id}\nchat_id: ${ctx.chat.id}`)
);

bot.on("photo", async (ctx) => {
  if (!isDirectMessage(ctx)) return;
  const staff = await findActiveStaff(ctx.from.id);
  if (!canActOnBehalfOfBots(staff)) return ctx.reply("你没有权限使用 Super AI。");

  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  lastPhotoByUser.set(ctx.from.id, photo.file_id);
  await ctx.reply("收到图片，告诉我要用来做什么（例如换哪个群的头像）。");
});

bot.on("text", async (ctx) => {
  if (!isDirectMessage(ctx)) return;
  const staff = await findActiveStaff(ctx.from.id);
  if (!canActOnBehalfOfBots(staff)) {
    return ctx.reply("你没有权限使用 Super AI，只有 CEO/COO 可以下指令。");
  }

  await ctx.sendChatAction("typing");
  const reply = await runBrain(ctx.message.text, {
    lastPhotoFileId: lastPhotoByUser.get(ctx.from.id),
  });
  await ctx.reply(reply);
});

// bot.launch()'s promise only resolves once the bot stops (it awaits the
// polling loop internally), so heartbeats can't live in a .then() after it —
// send one now and keep sending on an interval instead.
const sendHeartbeat = () =>
  heartbeat("super_ai", { capabilities: definitions.map((tool) => tool.name) }).catch((err) =>
    log.error("heartbeat failed:", err.message)
  );
sendHeartbeat();
const heartbeatTimer = setInterval(sendHeartbeat, 30000);

log.info("bot-super-ai launching...");
bot.launch({ allowedUpdates: ["message"] });

process.once("SIGINT", () => {
  clearInterval(heartbeatTimer);
  bot.stop("SIGINT");
});
process.once("SIGTERM", () => {
  clearInterval(heartbeatTimer);
  bot.stop("SIGTERM");
});
