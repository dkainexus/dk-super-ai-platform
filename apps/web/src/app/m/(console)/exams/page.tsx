import { requireMerchantUser, requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { activeCountry } from "@/modules/merchants/lib";
import { ExamsIndexView, type ExamRow } from "@/modules/exams/components/exam-views";
import type { Exam } from "@/lib/types";

export default async function MerchantExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cu = await requireMerchantUser();
  await requirePerm("exams", "view");
  const { active } = await activeCountry(cu);
  const { error } = await searchParams;

  let q = db()
    .from("exams")
    .select("*, items:exam_items(question_id)")
    .or(`merchant_id.is.null,merchant_id.eq.${cu.merchant.id}`)
    .order("sort")
    .order("created_at");
  if (active) q = q.or(`country_id.is.null,country_id.eq.${active.id}`);
  const { data: exams } = await q;

  const rows: ExamRow[] = ((exams ?? []) as (Exam & { items: { question_id: string }[] })[]).map((e) => ({
    ...e,
    question_count: e.items.length,
    scope_label: e.merchant_id ? "Your white label" : "Platform",
  }));

  return (
    <ExamsIndexView
      base="/m/exams"
      error={error}
      canAdd={Boolean(can(cu, "exams", "add"))}
      exams={rows}
    />
  );
}
