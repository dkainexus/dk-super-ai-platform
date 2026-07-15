const { getDb, telegram: telegramHelpers } = require("@dk/shared");

// job.scope: { group_id, telegram_chat_id }
// job.payload: { topic_key, name }
function createTopicHandler(telegram) {
  return async (job) => {
    const { group_id: groupId, telegram_chat_id: chatId } = job.scope;
    const { topic_key: topicKey, name } = job.payload;
    const db = getDb();

    const { data: existing } = await db
      .from("group_topics")
      .select("telegram_thread_id")
      .eq("group_id", groupId)
      .eq("topic_key", topicKey)
      .maybeSingle();
    if (existing?.telegram_thread_id) {
      return { telegram_thread_id: existing.telegram_thread_id, reused: true };
    }

    const topic = await telegramHelpers.createForumTopic(telegram, chatId, name);
    const { error } = await db.from("group_topics").upsert(
      {
        group_id: groupId,
        topic_key: topicKey,
        telegram_thread_id: topic.message_thread_id,
      },
      { onConflict: "group_id,topic_key" }
    );
    if (error) throw error;

    return { telegram_thread_id: topic.message_thread_id, reused: false };
  };
}

module.exports = { createTopicHandler };
