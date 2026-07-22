// job.scope: { owner_id }
// job.payload: { telegram_user_id, decision: 'approved'|'rejected', reason }
// Enqueued by the web CMS when a superadmin reviews a CMS owner that was
// collected over Telegram.
function notifyCmsOwnerReviewHandler(telegram) {
  return async (job) => {
    const { telegram_user_id: tgId, decision, reason } = job.payload;
    if (!tgId) return { ok: true, skipped: "no telegram user" };

    const message =
      decision === "approved"
        ? "🎉 Good news — your submission has been reviewed and APPROVED."
        : `❌ Your submission was rejected.${reason ? `\nReason: ${reason}` : ""}\nPlease contact your agent for the next steps.`;

    await telegram.sendMessage(tgId, message);
    return { ok: true };
  };
}

module.exports = { notifyCmsOwnerReviewHandler };
