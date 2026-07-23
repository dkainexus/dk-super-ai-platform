import { requireMerchantUser, requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { activeCountry } from "@/modules/merchants/lib";
import { QuestionBankView, type QuestionRow } from "@/modules/exams/components/exam-views";
import type { ExamQuestion } from "@/lib/types";

export default async function MerchantQuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cu = await requireMerchantUser();
  await requirePerm("exams", "view");
  const { active } = await activeCountry(cu);
  const { error } = await searchParams;

  let q = db()
    .from("exam_questions")
    .select("*")
    .or(`merchant_id.is.null,merchant_id.eq.${cu.merchant.id}`)
    .order("created_at", { ascending: false });
  if (active) q = q.or(`country_id.is.null,country_id.eq.${active.id}`);
  const { data: questions } = await q;

  const rows: QuestionRow[] = ((questions ?? []) as ExamQuestion[]).map((it) => ({
    ...it,
    editable: it.merchant_id === cu.merchant.id,
    scope_label: it.merchant_id ? "Your white label" : "Platform",
  }));

  return (
    <QuestionBankView
      base="/m/exams"
      error={error}
      canAdd={Boolean(can(cu, "exams", "add"))}
      canEdit={Boolean(can(cu, "exams", "edit"))}
      canDelete={Boolean(can(cu, "exams", "delete"))}
      questions={rows}
    />
  );
}
