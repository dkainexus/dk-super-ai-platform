import { requireMerchantUser, requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { activeCountry } from "@/modules/merchants/lib";
import { QuestionBankView, type QuestionRow } from "@/modules/exams/components/exam-views";
import type { ExamQuestion } from "@/lib/types";

export default async function MerchantQuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; generated?: string; saved?: string; category?: string }>;
}) {
  const cu = await requireMerchantUser();
  await requirePerm("exams", "view");
  const { active } = await activeCountry(cu);
  const { error, generated, saved, category = "" } = await searchParams;

  // Sets are defined per country by the platform; a white label works inside them.
  const { data: cats } = await db()
    .from("question_categories")
    .select("id, name")
    .eq("country_id", active?.id ?? "")
    .order("sort")
    .order("name");
  const categories = ((cats ?? []) as { id: string; name: string }[]).map((c) => ({ id: c.id, label: c.name }));
  const open = category === "none" ? { id: "none", label: "Not in a set" } : categories.find((c) => c.id === category);

  let q = db()
    .from("exam_questions")
    .select("*")
    .or(`merchant_id.is.null,merchant_id.eq.${cu.merchant.id}`)
    .order("sort").order("created_at");
  if (active) q = q.or(`country_id.is.null,country_id.eq.${active.id}`);
  if (category === "none") q = q.is("category_id", null);
  else if (category) q = q.eq("category_id", category);
  const { data: questions } = await q;

  const counts: Record<string, number> = {};
  let uncategorised = 0;
  for (const it of (questions ?? []) as ExamQuestion[]) {
    const cid = (it as ExamQuestion & { category_id?: string | null }).category_id;
    if (cid) counts[cid] = (counts[cid] ?? 0) + 1;
    else uncategorised++;
  }

  const rows: QuestionRow[] = (open ? ((questions ?? []) as ExamQuestion[]) : []).map((it) => ({
    ...it,
    editable: it.merchant_id === cu.merchant.id,
    scope_label: it.merchant_id ? "Your white label" : "Platform",
  }));

  return (
    <QuestionBankView
      base="/m/exams"
      error={error}
      generated={generated}
      saved={saved}
      canAdd={Boolean(can(cu, "exams", "add"))}
      canEdit={Boolean(can(cu, "exams", "edit"))}
      canDelete={Boolean(can(cu, "exams", "delete"))}
      questions={rows}
      categories={categories}
      category={open ?? null}
      categoryCounts={counts}
      uncategorised={uncategorised}
    />
  );
}
