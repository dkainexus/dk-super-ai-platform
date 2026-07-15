const { telegram: telegramHelpers } = require("@dk/shared");

// job.scope: { telegram_chat_id }
// job.payload: { telegram_user_id }
function promoteAdminHandler(telegram) {
  return async (job) => {
    const { telegram_chat_id: chatId } = job.scope;
    const { telegram_user_id: userId } = job.payload;
    await telegramHelpers.promoteStaffMember(telegram, chatId, userId);
    return { ok: true };
  };
}

module.exports = { promoteAdminHandler };
