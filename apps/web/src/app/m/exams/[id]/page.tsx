import { notFound } from "next/navigation";
import { requireMerchantUser, requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { activeCountry } from "@/modules/merchants/lib";
import { ExamDetailView } from "@/modules/exams/components/exam-views";
import type { Exam, ExamQuestion, TrainingVideo } from "@/lib/types";

export default async function MerchantExamDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const cu = await requireMerchantUser();
  await requirePerm("exams", "view");
  const { active } = await activeCountry(cu);
  const { id } = await params;
  const { error, saved } = await searchParams;

  const { data } = await db()
    .from("exams")
    .select("*, items:exam_items(question_id), videos:exam_videos(video_id)")
    .eq("id", id)
    .or(`merchant_id.is.null,merchant_id.eq.${cu.merchant.id}`)
    .maybeSingle();
  if (!data) notFound();
  const exam = data as Exam & { items: { question_id: string }[]; videos: { video_id: string }[] };
  const editable = exam.merchant_id === cu.merchant.id;
  const selectedQ = new Set(exam.items.map((i) => i.question_id));
  const selectedV = new Set(exam.videos.map((v) => v.video_id));

  // Own owners only in the attempts list.
  const { data: ownerRows } = await db().from("owners").select("id").eq("merchant_id", cu.merchant.id);
  const ownerIds = ((ownerRows ?? []) as { id: string }[]).map((o) => o.id);

  let qq = db()
    .from("exam_questions")
    .select("*")
    .eq("active", true)
    .or(`merchant_id.is.null,merchant_id.eq.${cu.merchant.id}`)
    .order("created_at");
  if (active) qq = qq.or(`country_id.is.null,country_id.eq.${active.id}`);
  let vq = db()
    .from("training_videos")
    .select("*")
    .eq("published", true)
    .or(`merchant_id.is.null,merchant_id.eq.${cu.merchant.id}`)
    .order("sort");
  if (active) vq = vq.or(`country_id.is.null,country_id.eq.${active.id}`);

  const [{ data: questions }, { data: videos }, { data: attempts }] = await Promise.all([
    qq,
    vq,
    ownerIds.length
      ? db()
          .from("exam_attempts")
          .select("id, score, passed, created_at, owner:owners(full_name)")
          .eq("exam_id", id)
          .in("owner_id", ownerIds)
          .order("created_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <ExamDetailView
      base="/m/exams"
      exam={exam}
      error={error}
      saved={saved}
      canEdit={Boolean(can(cu, "exams", "edit"))}
      canDelete={Boolean(can(cu, "exams", "delete"))}
      editable={editable}
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
    />
  );
}
