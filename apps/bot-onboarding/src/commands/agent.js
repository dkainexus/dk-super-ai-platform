const { getDb } = require("@dk/shared");
const { findOrCreateGroup } = require("../lib/groups");

// Reply to the General Agent's message with /agent to bind them as this
// group's general agent (mirrors the Notion workflow's step 1.2).
function registerAgentCommand(bot) {
  bot.command("agent", async (ctx) => {
    const target = ctx.message.reply_to_message;
    if (!target) {
      return ctx.reply("回复总代理发的消息并输入 /agent");
    }

    const group = await findOrCreateGroup(ctx.chat.id, { title: ctx.chat.title });
    const db = getDb();
    const agentUser = target.from;

    const { data: staff, error: staffError } = await db
      .from("staff")
      .upsert(
        {
          telegram_user_id: agentUser.id,
          name: [agentUser.first_name, agentUser.last_name].filter(Boolean).join(" "),
          role: "agent",
        },
        { onConflict: "telegram_user_id", ignoreDuplicates: false }
      )
      .select()
      .single();
    if (staffError) throw staffError;

    const { error: groupError } = await db
      .from("groups")
      .update({ general_agent_id: staff.id })
      .eq("id", group.id);
    if (groupError) throw groupError;

    await db.from("group_bindings").upsert(
      { group_id: group.id, agent_staff_id: staff.id },
      { onConflict: "group_id" }
    );

    await ctx.reply(`Binded ${staff.name || agentUser.id} as Agent. Who is applicant?`);
  });
}

module.exports = { registerAgentCommand };
