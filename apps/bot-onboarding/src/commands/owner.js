const { getDb, i18n } = require("@dk/shared");
const { findOrCreateGroup, ensureTopic } = require("../lib/groups");

// Reply to the applicant's message with /owner to bind them as the
// candidate for this group, then create the Documentation topic and post
// the document-submission button (Notion workflow steps 1.3-1.4).
function registerOwnerCommand(bot) {
  bot.command("owner", async (ctx) => {
    const target = ctx.message.reply_to_message;
    if (!target) {
      return ctx.reply("回复申请人发的消息并输入 /owner");
    }

    const group = await findOrCreateGroup(ctx.chat.id, { title: ctx.chat.title });
    const db = getDb();
    const applicant = target.from;

    const { data: candidate, error: candidateError } = await db
      .from("candidates")
      .insert({
        group_id: group.id,
        telegram_user_id: applicant.id,
        full_name: [applicant.first_name, applicant.last_name].filter(Boolean).join(" "),
        status: "bound",
      })
      .select()
      .single();
    if (candidateError) throw candidateError;

    await db.from("group_bindings").upsert(
      {
        group_id: group.id,
        owner_candidate_id: candidate.id,
        bound_at: new Date().toISOString(),
      },
      { onConflict: "group_id" }
    );

    const threadId = await ensureTopic(group, "documentation", "Documentation");

    await ctx.telegram.sendMessage(
      ctx.chat.id,
      i18n.t("documentation_intro", group.lang),
      {
        message_thread_id: threadId,
        reply_markup: {
          inline_keyboard: [
            [{ text: "Submit Document", callback_data: `submit_doc:${candidate.id}` }],
          ],
        },
      }
    );

    await ctx.reply(`Applicant bound. Documentation topic ready.`);
  });
}

module.exports = { registerOwnerCommand };
