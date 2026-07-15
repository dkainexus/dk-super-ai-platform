const { getDb, telegram: telegramHelpers } = require("@dk/shared");

// job.scope: { group_id, telegram_chat_id }
// job.payload: { file_id }
function setAvatarHandler(telegram) {
  return async (job) => {
    const { group_id: groupId, telegram_chat_id: chatId } = job.scope;
    const { file_id: fileId } = job.payload;

    await telegramHelpers.setGroupAvatarFromFileId(telegram, chatId, fileId);

    const db = getDb();
    const { error } = await db
      .from("groups")
      .update({ avatar_file_id: fileId })
      .eq("id", groupId);
    if (error) throw error;

    return { ok: true };
  };
}

module.exports = { setAvatarHandler };
