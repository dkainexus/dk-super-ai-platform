import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { QuestionBankView, type QuestionRow } from "@/modules/exams/components/exam-views";
import type { Country, ExamQuestion, Merchant } from "@/lib/types";

export default async function AdminQuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("exams", "view");
  const { error } = await searchParams;

  const [{ data: questions }, { data: merchants }, { data: countries }] = await Promise.all([
    db().from("exam_questions").select("*").order("created_at", { ascending: false }),
    db().from("merchants").select("*").eq("status", "active").order("name"),
    db().from("countries").select("*").eq("active", true).order("sort"),
  ]);
  const wls = (merchants ?? []) as Merchant[];
  const cs = (countries ?? []) as Country[];
  const wlName = new Map(wls.map((m) => [m.id, m.name]));
  const cName = new Map(cs.map((c) => [c.id, `${c.flag} ${c.name}`]));

  const rows: QuestionRow[] = ((questions ?? []) as ExamQuestion[]).map((q) => ({
    ...q,
    editable: true,
    scope_label: `${q.merchant_id ? wlName.get(q.merchant_id) ?? "?" : "All white labels"} · ${
      q.country_id ? cName.get(q.country_id) ?? "?" : "All countries"
    }`,
  }));

  return (
    <QuestionBankView
      base="/admin/exams"
      error={error}
      canAdd={Boolean(can(cu, "exams", "add"))}
      canEdit={Boolean(can(cu, "exams", "edit"))}
      canDelete={Boolean(can(cu, "exams", "delete"))}
      questions={rows}
      merchants={wls.map((m) => ({ id: m.id, label: m.name }))}
      countries={cs.map((c) => ({ id: c.id, label: `${c.flag} ${c.name}` }))}
    />
  );
}
