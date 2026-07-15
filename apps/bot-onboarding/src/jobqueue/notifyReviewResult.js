const { getDb, i18n } = require("@dk/shared");
const { ensureTopic } = require("../lib/groups");

// job.scope: { candidate_id }
// job.payload: { approved: boolean }
// Enqueued by the web app after a staff member approves/rejects a
// candidate's documents (the web app is the job producer here).
function notifyReviewResultHandler(telegram) {
  return async (job) => {
    const { candidate_id: candidateId } = job.scope;
    const { approved } = job.payload;
    const db = getDb();

    const { data: candidate, error } = await db
      .from("candidates")
      .select("*, groups(*)")
      .eq("id", candidateId)
      .single();
    if (error) throw error;

    const group = candidate.groups;
    const threadId = await ensureTopic(group, "notification", "Notification");
    const messageKey = approved ? "documents_approved" : "documents_rejected";

    await telegram.sendMessage(group.telegram_chat_id, i18n.t(messageKey, group.lang), {
      message_thread_id: threadId,
    });

    await db
      .from("candidates")
      .update({ status: approved ? "doc_approved" : "doc_rejected" })
      .eq("id", candidateId);

    return { ok: true };
  };
}

module.exports = { notifyReviewResultHandler };
