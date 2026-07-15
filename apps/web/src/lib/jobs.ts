import "server-only";
import { db } from "./supabase";

type CreateJobInput = {
  jobType: string;
  targetBot: string;
  scope?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  requestedBy?: Record<string, unknown>;
};

// Mirrors packages/shared/jobs.js#createJob (bots) — the web app is a job
// producer too (see plan section 5: it enqueues onboarding.notify_review_result).
export async function createJob({
  jobType,
  targetBot,
  scope = {},
  payload = {},
  requestedBy,
}: CreateJobInput) {
  const { data, error } = await db()
    .from("bot_jobs")
    .insert({
      job_type: jobType,
      target_bot: targetBot,
      scope,
      payload,
      requested_by: requestedBy ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
