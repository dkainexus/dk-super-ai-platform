const { getDb, createJob, waitForJob } = require("@dk/shared");

const definition = {
  name: "change_group_avatar",
  description:
    "Change a Telegram client group's avatar/photo. Dispatches the change to the group-ops bot and waits for it to complete. Requires the file_id of a photo the staff member has already sent.",
  input_schema: {
    type: "object",
    properties: {
      group_query: {
        type: "string",
        description: "Group title or code to search for, e.g. 'A1' or 'Somchai Group'.",
      },
      file_id: {
        type: "string",
        description: "Telegram file_id of the new photo, from a message the staff member sent.",
      },
    },
    required: ["group_query", "file_id"],
  },
};

async function resolveGroup(query) {
  const db = getDb();
  const { data, error } = await db
    .from("groups")
    .select("*")
    .or(`title.ilike.%${query}%,code.ilike.%${query}%`);
  if (error) throw error;
  return data;
}

async function handler({ group_query: groupQuery, file_id: fileId }) {
  const matches = await resolveGroup(groupQuery);
  if (matches.length === 0) {
    return { ok: false, message: `没有找到匹配 "${groupQuery}" 的群。` };
  }
  if (matches.length > 1) {
    const names = matches.map((g) => g.title || g.code).join(", ");
    return { ok: false, message: `匹配到多个群，请说得更具体一点：${names}` };
  }

  const group = matches[0];
  const job = await createJob({
    jobType: "group.set_avatar",
    targetBot: "group_ops",
    scope: { group_id: group.id, telegram_chat_id: group.telegram_chat_id },
    payload: { file_id: fileId },
    requestedBy: { source: "super_ai" },
  });
  const finished = await waitForJob(job.id);

  if (finished.status === "done") {
    return { ok: true, message: `已把「${group.title || group.code}」的头像换好了。` };
  }
  return {
    ok: false,
    message: `换头像失败：${finished.error || "任务超时，请稍后用 /jobs 检查状态"}`,
  };
}

module.exports = { definition, handler };
