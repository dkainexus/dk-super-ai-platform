"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requireUser, canReview } from "@/lib/auth";
import { createJob } from "@/lib/jobs";

export async function reviewCandidateAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!canReview(user)) throw new Error("not authorized to review documents");

  const candidateId = String(formData.get("candidateId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!candidateId || (decision !== "approved" && decision !== "rejected")) {
    throw new Error("invalid review submission");
  }

  const supabase = db();
  await supabase
    .from("document_submissions")
    .update({
      review_status: decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("candidate_id", candidateId)
    .eq("review_status", "pending");

  // The onboarding bot owns posting into the group's Notification topic and
  // moving the candidate's status forward — the web app is a job producer,
  // not the one talking to Telegram directly (see plan section 5).
  await createJob({
    jobType: "onboarding.notify_review_result",
    targetBot: "onboarding",
    scope: { candidate_id: candidateId },
    payload: { approved: decision === "approved" },
    requestedBy: { source: "web", staff_id: user.id },
  });

  revalidatePath("/dashboard/documents");
}
