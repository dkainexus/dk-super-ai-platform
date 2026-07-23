import { notFound } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { ExamDetailView } from "@/modules/exams/components/exam-views";
import type { Country, Exam, ExamQuestion, Merchant, TrainingVideo } from "@/lib/types";

export default async function AdminExamDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { cu } = await requirePerm("exams", "view");
  const { id } = await params;
  const { error, saved } = await searchParams;

  const { data } = await db()
    .from("exams")
    .select("*, items:exam_items(question_id), videos:exam_videos(video_id)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const exam = data as Exam & { items: { question_id: string }[]; videos: { video_id: string }[] };
  const selectedQ = new Set(exam.items.map((i) => i.question_id));
  const selectedV = new Set(exam.videos.map((v) => v.video_id));

  const [{ data: questions }, { data: videos }, { data: merchants }, { data: countries }, { data: attempts }] =
    await Promise.all([
      db().from("exam_questions").select("*").eq("active", true).order("created_at"),
      db().from("training_videos").select("*").eq("published", true).order("sort"),
      db().from("merchants").select("*").eq("status", "active").order("name"),
      db().from("countries").select("*").eq("active", true).order("sort"),
      db()
        .from("exam_attempts")
        .select("id, score, passed, created_at, owner:owners(full_name)")
        .eq("exam_id", id)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  return (
    <ExamDetailView
      base="/admin/exams"
      exam={exam}
      error={error}
      saved={saved}
      canEdit={Boolean(can(cu, "exams", "edit"))}
      canDelete={Boolean(can(cu, "exams", "delete"))}
      editable
      questionOptions={((questions ?? []) as ExamQuestion[]).map((q) => ({
        id: q.id,
        label: `${q.type === "choice" ? "🔘" : "✍️"} ${q.question} (${q.points} pt)`,
        selected: selectedQ.has(q.id),
      }))}
      videoOptions={((videos ?? []) as TrainingVideo[]).map((v) => ({
        id: v.id,
        label: v.title,
        selected: selectedV.has(v.id),
      }))}
      attempts={((attempts ?? []) as unknown as {
        id: string;
        score: number | null;
        passed: boolean | null;
        created_at: string;
        owner: { full_name: string | null } | null;
      }[]).map((a) => ({
        id: a.id,
        owner_name: a.owner?.full_name ?? "(deleted owner)",
        score: a.score != null ? Number(a.score) : null,
        passed: a.passed,
        created_at: a.created_at,
      }))}
      merchants={((merchants ?? []) as Merchant[]).map((m) => ({ id: m.id, label: m.name }))}
      countries={((countries ?? []) as Country[]).map((c) => ({ id: c.id, label: `${c.flag} ${c.name}` }))}
    />
  );
}
