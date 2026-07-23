import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { ExamsIndexView, type ExamRow } from "@/modules/exams/components/exam-views";
import type { Country, Exam, Merchant } from "@/lib/types";

export default async function AdminExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("exams", "view");
  const { error } = await searchParams;

  const [{ data: exams }, { data: merchants }, { data: countries }] = await Promise.all([
    db().from("exams").select("*, items:exam_items(question_id)").order("sort").order("created_at"),
    db().from("merchants").select("*").eq("status", "active").order("name"),
    db().from("countries").select("*").eq("active", true).order("sort"),
  ]);
  const wls = (merchants ?? []) as Merchant[];
  const cs = (countries ?? []) as Country[];
  const wlName = new Map(wls.map((m) => [m.id, m.name]));
  const cName = new Map(cs.map((c) => [c.id, `${c.flag} ${c.name}`]));

  const rows: ExamRow[] = ((exams ?? []) as (Exam & { items: { question_id: string }[] })[]).map((e) => ({
    ...e,
    question_count: e.items.length,
    scope_label: `${e.merchant_id ? wlName.get(e.merchant_id) ?? "?" : "All white labels"} · ${
      e.country_id ? cName.get(e.country_id) ?? "?" : "All countries"
    }`,
  }));

  return (
    <ExamsIndexView
      base="/admin/exams"
      error={error}
      canAdd={Boolean(can(cu, "exams", "add"))}
      exams={rows}
      merchants={wls.map((m) => ({ id: m.id, label: m.name }))}
      countries={cs.map((c) => ({ id: c.id, label: `${c.flag} ${c.name}` }))}
    />
  );
}
