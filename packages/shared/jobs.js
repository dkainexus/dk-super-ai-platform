const { getDb } = require("./db");

const TERMINAL_STATUSES = ["done", "error", "cancelled"];

async function createJob({
  jobType,
  targetBot,
  scope = {},
  payload = {},
  requestedBy = null,
  runAt = null,
  priority = 100,
}) {
  const db = getDb();
  const { data, error } = await db
    .from("bot_jobs")
    .insert({
      job_type: jobType,
      target_bot: targetBot,
      scope,
      payload,
      requested_by: requestedBy,
      run_at: runAt || new Date().toISOString(),
      priority,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// One row per item, sharing a batch_id in requested_by, so per-target progress
// and per-target retry can be tracked independently (see plan section 2).
async function createJobBatch(jobs, { batchId, requestedBy = {} } = {}) {
  const db = getDb();
  const rows = jobs.map((job) => ({
    job_type: job.jobType,
    target_bot: job.targetBot,
    scope: job.scope || {},
    payload: job.payload || {},
    requested_by: { ...requestedBy, batch_id: batchId },
    run_at: job.runAt || new Date().toISOString(),
    priority: job.priority ?? 100,
  }));
  const { data, error } = await db.from("bot_jobs").insert(rows).select();
  if (error) throw error;
  return data;
}

// Optimistic claim: read candidates, then compare-and-swap each one
// (update only succeeds while status is still 'pending'). At this bot
// count and poll interval, a real double-claim race is negligible, and
// this avoids needing a dedicated Postgres RPC for `FOR UPDATE SKIP LOCKED`.
async function claimNext(targetBot, { limit = 5, instanceId } = {}) {
  const db = getDb();
  const { data: candidates, error } = await db
    .from("bot_jobs")
    .select("id")
    .eq("target_bot", targetBot)
    .eq("status", "pending")
    .lte("run_at", new Date().toISOString())
    .order("priority", { ascending: true })
    .order("run_at", { ascending: true })
    .limit(limit * 3);
  if (error) throw error;
  if (!candidates?.length) return [];

  const claimed = [];
  for (const { id } of candidates) {
    if (claimed.length >= limit) break;
    const { data, error: updateError } = await db
      .from("bot_jobs")
      .update({
        status: "claimed",
        claimed_at: new Date().toISOString(),
        claimed_by: instanceId,
      })
      .eq("id", id)
      .eq("status", "pending")
      .select()
      .maybeSingle();
    if (updateError) throw updateError;
    if (data) claimed.push(data);
  }
  return claimed;
}

async function completeJob(id, result = {}) {
  const db = getDb();
  const { error } = await db
    .from("bot_jobs")
    .update({ status: "done", result, completed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

async function failJob(id, errorMessage, { attempts, maxAttempts, backoffMs = 30_000 }) {
  const db = getDb();
  const nextAttempts = attempts + 1;
  const exhausted = nextAttempts >= maxAttempts;
  const { error } = await db
    .from("bot_jobs")
    .update({
      status: exhausted ? "error" : "pending",
      attempts: nextAttempts,
      error: errorMessage,
      run_at: exhausted ? undefined : new Date(Date.now() + backoffMs).toISOString(),
      completed_at: exhausted ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw error;
}

async function heartbeat(botKey, { displayName, telegramBotUsername, capabilities = [] } = {}) {
  const db = getDb();
  const { error } = await db.from("bot_registry").upsert(
    {
      bot_key: botKey,
      display_name: displayName,
      telegram_bot_username: telegramBotUsername,
      capabilities,
      status: "online",
      last_heartbeat_at: new Date().toISOString(),
    },
    { onConflict: "bot_key" }
  );
  if (error) throw error;
}

// Runs a job-claim loop forever: poll -> execute matching handler -> report.
// `handlers` maps job_type -> async (job) => result
function startWorker(botKey, handlers, { intervalMs = 7000, instanceId = `${botKey}-${process.pid}` } = {}) {
  let stopped = false;
  async function tick() {
    if (stopped) return;
    try {
      const jobs = await claimNext(botKey, { instanceId });
      for (const job of jobs) {
        const handler = handlers[job.job_type];
        try {
          if (!handler) throw new Error(`no handler for job_type "${job.job_type}"`);
          const result = await handler(job);
          await completeJob(job.id, result || {});
        } catch (err) {
          await failJob(job.id, err.message, {
            attempts: job.attempts,
            maxAttempts: job.max_attempts,
          });
        }
      }
      await heartbeat(botKey, { capabilities: Object.keys(handlers) });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[${botKey}] worker tick failed:`, err.message);
    } finally {
      if (!stopped) setTimeout(tick, intervalMs);
    }
  }
  tick();
  return () => {
    stopped = true;
  };
}

// Polls a single job by id until it reaches a terminal status, or timeout.
async function waitForJob(id, { timeoutMs = 20_000, pollMs = 1000 } = {}) {
  const db = getDb();
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { data, error } = await db.from("bot_jobs").select("*").eq("id", id).single();
    if (error) throw error;
    if (TERMINAL_STATUSES.includes(data.status) || Date.now() > deadline) return data;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

// Polls until every job sharing `batchId` reaches a terminal status, or timeout.
async function waitForBatch(batchId, { timeoutMs = 20_000, pollMs = 1500 } = {}) {
  const db = getDb();
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { data, error } = await db
      .from("bot_jobs")
      .select("*")
      .eq("requested_by->>batch_id", batchId);
    if (error) throw error;
    const allTerminal = data.every((job) => TERMINAL_STATUSES.includes(job.status));
    if (allTerminal || Date.now() > deadline) return data;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

module.exports = {
  createJob,
  createJobBatch,
  claimNext,
  completeJob,
  failJob,
  heartbeat,
  startWorker,
  waitForJob,
  waitForBatch,
};
