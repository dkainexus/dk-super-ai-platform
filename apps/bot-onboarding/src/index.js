require("dotenv").config();
const { Telegraf } = require("telegraf");
const { startWorker, createLogger } = require("@dk/shared");
const { registerAgentCommand } = require("./commands/agent");
const { registerOwnerCommand } = require("./commands/owner");
const { registerDocumentFlow } = require("./flows/documentSubmission");
const { notifyReviewResultHandler } = require("./jobqueue/notifyReviewResult");

const log = createLogger("bot-onboarding");

if (!process.env.BOT_TOKEN_ONBOARDING) {
  throw new Error("BOT_TOKEN_ONBOARDING is required");
}

const bot = new Telegraf(process.env.BOT_TOKEN_ONBOARDING);

bot.catch((err, ctx) => {
  log.error(`unhandled error for update ${ctx.update.update_id}:`, err);
});

bot.command("whoami", (ctx) =>
  ctx.reply(`user_id: ${ctx.from.id}\nchat_id: ${ctx.chat.id}`)
);

registerAgentCommand(bot);
registerOwnerCommand(bot);
registerDocumentFlow(bot);

const stopWorker = startWorker(
  "onboarding",
  {
    "onboarding.notify_review_result": notifyReviewResultHandler(bot.telegram),
  },
  { intervalMs: 5000 }
);

// bot.launch()'s promise only resolves once the bot stops (it awaits the
// polling loop internally) — log before launching, not in a .then() after it.
log.info("bot-onboarding launching...");
bot.launch({ allowedUpdates: ["message", "callback_query"] });

process.once("SIGINT", () => {
  stopWorker();
  bot.stop("SIGINT");
});
process.once("SIGTERM", () => {
  stopWorker();
  bot.stop("SIGTERM");
});
