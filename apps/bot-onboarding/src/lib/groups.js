const { getDb } = require("@dk/shared");

async function findOrCreateGroup(chatId, { title } = {}) {
  const db = getDb();
  const { data: existing, error: findError } = await db
    .from("groups")
    .select("*")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing;

  const { data, error } = await db
    .from("groups")
    .insert({ telegram_chat_id: chatId, title, status: "setup" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Asks bot-group-ops to create a topic and blocks until it's ready,
// returning the Telegram message_thread_id.
async function ensureTopic(group, topicKey, name) {
  const { createJob, waitForJob } = require("@dk/shared");
  const job = await createJob({
    jobType: "group.create_topic",
    targetBot: "group_ops",
    scope: { group_id: group.id, telegram_chat_id: group.telegram_chat_id },
    payload: { topic_key: topicKey, name },
    requestedBy: { source: "bot-onboarding" },
  });
  const finished = await waitForJob(job.id);
  if (finished.status !== "done") {
    throw new Error(`group.create_topic job failed: ${finished.error || "timed out"}`);
  }
  return finished.result.telegram_thread_id;
}

module.exports = { findOrCreateGroup, ensureTopic };
