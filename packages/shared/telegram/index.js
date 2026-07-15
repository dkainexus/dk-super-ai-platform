const { Input } = require("telegraf");

// Fixed admin rights granted to authorized staff who join a group (ported
// intent from the old autopromote.js: enough to run the operation, not
// enough to promote other members).
const STAFF_ADMIN_RIGHTS = {
  can_manage_chat: true,
  can_change_info: true,
  can_delete_messages: true,
  can_restrict_members: true,
  can_invite_users: true,
  can_pin_messages: true,
  can_manage_topics: true,
  can_promote_members: false,
};

async function createForumTopic(telegram, chatId, name) {
  return telegram.createForumTopic(chatId, name);
}

async function renameForumTopic(telegram, chatId, messageThreadId, name) {
  return telegram.editForumTopic(chatId, messageThreadId, { name });
}

async function renameGroupTitle(telegram, chatId, title) {
  return telegram.setChatTitle(chatId, title);
}

async function setGroupAvatarFromFileId(telegram, chatId, fileId) {
  const link = await telegram.getFileLink(fileId);
  return telegram.setChatPhoto(chatId, Input.fromURL(link.href));
}

async function promoteStaffMember(telegram, chatId, userId) {
  return telegram.promoteChatMember(chatId, userId, STAFF_ADMIN_RIGHTS);
}

module.exports = {
  STAFF_ADMIN_RIGHTS,
  createForumTopic,
  renameForumTopic,
  renameGroupTitle,
  setGroupAvatarFromFileId,
  promoteStaffMember,
};
