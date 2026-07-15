const { getDb, i18n } = require("@dk/shared");
const { ensureTopic } = require("../lib/groups");

const DOC_STEPS = ["photo_full_body", "id_front", "id_back", "tabian_baan"];
const DOC_PROMPT_KEY = {
  photo_full_body: "doc_prompt_photo_full_body",
  id_front: "doc_prompt_id_front",
  id_back: "doc_prompt_id_back",
  tabian_baan: "doc_prompt_tabian_baan",
};

// State is derived from `document_submissions` rows rather than kept in
// memory, so the flow survives a bot restart mid-upload.
async function nextMissingDocType(db, candidateId) {
  const { data, error } = await db
    .from("document_submissions")
    .select("doc_type")
    .eq("candidate_id", candidateId)
    .neq("review_status", "rejected");
  if (error) throw error;
  const done = new Set(data.map((row) => row.doc_type));
  return DOC_STEPS.find((step) => !done.has(step)) || null;
}

async function finalizeSubmission(ctx, group, candidate) {
  const db = getDb();
  await db.from("candidates").update({ status: "docs_submitted" }).eq("id", candidate.id);

  const threadId = await ensureTopic(group, "notification", "Notification");
  await ctx.telegram.sendMessage(
    ctx.chat.id,
    i18n.t("documents_submitted", group.lang),
    { message_thread_id: threadId }
  );
  await ctx.telegram.sendMessage(
    ctx.chat.id,
    i18n.t("documents_status_pending", group.lang),
    { message_thread_id: threadId }
  );

  await db.from("candidates").update({ status: "doc_review_pending" }).eq("id", candidate.id);
}

function registerDocumentFlow(bot) {
  bot.action(/^submit_doc:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const candidateId = ctx.match[1];
    const db = getDb();
    const { data: candidate } = await db
      .from("candidates")
      .select("*, groups(*)")
      .eq("id", candidateId)
      .single();
    if (!candidate) return;

    const lang = candidate.groups?.lang;
    const nextType = (await nextMissingDocType(db, candidateId)) || DOC_STEPS[0];
    await ctx.reply(i18n.t(DOC_PROMPT_KEY[nextType], lang));
  });

  bot.on(["photo", "document"], async (ctx, next) => {
    if (!ctx.message.message_thread_id) return next && next();
    const db = getDb();

    const { data: group } = await db
      .from("groups")
      .select("*")
      .eq("telegram_chat_id", ctx.chat.id)
      .maybeSingle();
    if (!group) return next && next();

    const { data: topic } = await db
      .from("group_topics")
      .select("*")
      .eq("group_id", group.id)
      .eq("topic_key", "documentation")
      .maybeSingle();
    if (!topic || topic.telegram_thread_id !== ctx.message.message_thread_id) {
      return next && next();
    }

    const { data: candidate } = await db
      .from("candidates")
      .select("*")
      .eq("group_id", group.id)
      .eq("telegram_user_id", ctx.from.id)
      .in("status", ["bound", "doc_rejected"])
      .maybeSingle();
    if (!candidate) return next && next();

    const docType = await nextMissingDocType(db, candidate.id);
    if (!docType) return next && next();

    const fileId = ctx.message.photo
      ? ctx.message.photo[ctx.message.photo.length - 1].file_id
      : ctx.message.document.file_id;

    await db.from("document_submissions").insert({
      candidate_id: candidate.id,
      doc_type: docType,
      file_id: fileId,
    });

    const remaining = await nextMissingDocType(db, candidate.id);
    if (remaining) {
      await ctx.reply(i18n.t(DOC_PROMPT_KEY[remaining], group.lang));
    } else {
      await finalizeSubmission(ctx, group, candidate);
    }
  });
}

module.exports = { registerDocumentFlow };
