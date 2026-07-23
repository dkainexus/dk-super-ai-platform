"use server";

// Exams module actions: question bank + exam papers. Merchant users are
// forced to their own white label + active country, mirroring Training.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { activeCountry } from "@/modules/merchants/lib";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

function revalidate() {
  revalidatePath("/admin/exams");
  revalidatePath("/m/exams");
}

async function merchantScope(cu: Awaited<ReturnType<typeof requirePerm>>["cu"]) {
  if (!cu.merchant) return { merchantId: null as string | null, countryId: null as string | null };
  const { active } = await activeCountry(cu);
  return { merchantId: cu.merchant.id, countryId: active?.id ?? null };
}

// ---------- Question bank ----------

export async function saveQuestion(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const { cu } = await requirePerm("exams", id ? "edit" : "add");
  const back = String(formData.get("back") ?? "/admin/exams/questions");

  const type = String(formData.get("type") ?? "choice") === "essay" ? "essay" : "choice";
  const question = String(formData.get("question") ?? "").trim();
  const points = Math.max(1, parseInt(String(formData.get("points") ?? "1"), 10) || 1);
  const options = (formData.getAll("options") as string[]).map((o) => o.trim()).filter(Boolean);
  const correctIndex = parseInt(String(formData.get("correct_index") ?? "-1"), 10);
  const modelAnswer = String(formData.get("model_answer") ?? "").trim() || null;
  // Creation form has no Active checkbox (defaults true); the edit form marks
  // its presence with active_edit so an unchecked box means inactive.
  const active = formData.get("active_edit") ? formData.get("active") === "on" : true;

  if (!question) fail(back, "Please enter the question");
  if (type === "choice") {
    if (options.length < 2) fail(back, "A choice question needs at least 2 options");
    if (correctIndex < 0 || correctIndex >= options.length) fail(back, "Please mark the correct option");
  }

  const row: Record<string, unknown> = {
    type,
    question,
    points,
    options: type === "choice" ? options : [],
    correct_index: type === "choice" ? correctIndex : null,
    model_answer: type === "essay" ? modelAnswer : null,
    active,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    let q = db().from("exam_questions").update(row).eq("id", id);
    if (cu.merchant) q = q.eq("merchant_id", cu.merchant.id);
    const { error } = await q;
    if (error) fail(back, `Failed to save: ${error.message}`);
  } else {
    if (cu.merchant) {
      const scope = await merchantScope(cu);
      row.merchant_id = scope.merchantId;
      row.country_id = scope.countryId;
    } else {
      row.merchant_id = String(formData.get("merchant_id") ?? "") || null;
      row.country_id = String(formData.get("country_id") ?? "") || null;
    }
    row.created_by = cu.user.id;
    const { error } = await db().from("exam_questions").insert(row);
    if (error) fail(back, `Failed to create: ${error.message}`);
  }
  revalidate();
  redirect(back);
}

export async function deleteQuestion(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("exams", "delete");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? "/admin/exams/questions");
  let q = db().from("exam_questions").delete().eq("id", id);
  if (cu.merchant) q = q.eq("merchant_id", cu.merchant.id);
  await q;
  revalidate();
  redirect(back);
}

// ---------- Exams ----------

export async function createExam(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("exams", "add");
  const base = cu.merchant ? "/m/exams" : "/admin/exams";
  const title = String(formData.get("title") ?? "").trim();
  if (!title) fail(base, "Please enter a title");

  const row: Record<string, unknown> = {
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    pass_score: Math.min(100, Math.max(0, parseInt(String(formData.get("pass_score") ?? "70"), 10) || 70)),
    retake_wait_minutes: Math.max(0, parseInt(String(formData.get("retake_wait_minutes") ?? "0"), 10) || 0),
    created_by: cu.user.id,
  };
  if (cu.merchant) {
    const scope = await merchantScope(cu);
    row.merchant_id = scope.merchantId;
    row.country_id = scope.countryId;
  } else {
    row.merchant_id = String(formData.get("merchant_id") ?? "") || null;
    row.country_id = String(formData.get("country_id") ?? "") || null;
  }

  const { data, error } = await db().from("exams").insert(row).select("id").single();
  if (error) fail(base, `Failed to create: ${error.message}`);
  revalidate();
  redirect(`${base}/${data.id}`);
}

export async function updateExam(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("exams", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? `/admin/exams/${id}`);
  const title = String(formData.get("title") ?? "").trim();
  if (!title) fail(back, "Title cannot be empty");

  const patch: Record<string, unknown> = {
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    pass_score: Math.min(100, Math.max(0, parseInt(String(formData.get("pass_score") ?? "70"), 10) || 70)),
    retake_wait_minutes: Math.max(0, parseInt(String(formData.get("retake_wait_minutes") ?? "0"), 10) || 0),
    sort: parseInt(String(formData.get("sort") ?? "100"), 10) || 100,
    published: formData.get("published") === "on",
    updated_at: new Date().toISOString(),
  };
  if (!cu.merchant) {
    patch.merchant_id = String(formData.get("merchant_id") ?? "") || null;
    patch.country_id = String(formData.get("country_id") ?? "") || null;
  }

  let q = db().from("exams").update(patch).eq("id", id);
  if (cu.merchant) q = q.eq("merchant_id", cu.merchant.id);
  const { error } = await q;
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidate();
  redirect(back);
}

/** Save the paper: selected questions and required videos (checkbox lists). */
export async function saveExamContent(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("exams", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? `/admin/exams/${id}`);

  let guard = db().from("exams").select("id").eq("id", id);
  if (cu.merchant) guard = guard.eq("merchant_id", cu.merchant.id);
  const { data: exam } = await guard.maybeSingle();
  if (!exam) fail(back, "Exam not found");

  const questionIds = (formData.getAll("question_ids") as string[]).filter(Boolean);
  const videoIds = (formData.getAll("video_ids") as string[]).filter(Boolean);

  await db().from("exam_items").delete().eq("exam_id", id);
  if (questionIds.length) {
    const { error } = await db()
      .from("exam_items")
      .insert(questionIds.map((qid, i) => ({ exam_id: id, question_id: qid, sort: (i + 1) * 10 })));
    if (error) fail(back, `Failed to save questions: ${error.message}`);
  }
  await db().from("exam_videos").delete().eq("exam_id", id);
  if (videoIds.length) {
    const { error } = await db()
      .from("exam_videos")
      .insert(videoIds.map((vid) => ({ exam_id: id, video_id: vid })));
    if (error) fail(back, `Failed to save videos: ${error.message}`);
  }
  revalidate();
  redirect(`${back}?saved=1`);
}

export async function deleteExam(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("exams", "delete");
  const id = String(formData.get("id") ?? "");
  const base = cu.merchant ? "/m/exams" : "/admin/exams";
  let q = db().from("exams").delete().eq("id", id);
  if (cu.merchant) q = q.eq("merchant_id", cu.merchant.id);
  await q;
  revalidate();
  redirect(base);
}
