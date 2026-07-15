const { getDb, telegram: telegramHelpers } = require("@dk/shared");

// job.scope: { group_id, telegram_chat_id }
// job.payload: { title }
function renameGroupHandler(telegram) {
  return async (job) => {
    const { group_id: groupId, telegram_chat_id: chatId } = job.scope;
    const { title } = job.payload;

    await telegramHelpers.renameGroupTitle(telegram, chatId, title);

    const db = getDb();
    const { error } = await db.from("groups").update({ title }).eq("id", groupId);
    if (error) throw error;

    return { ok: true };
  };
}

module.exports = { renameGroupHandler };
