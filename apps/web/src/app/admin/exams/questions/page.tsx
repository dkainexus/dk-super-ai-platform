import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { QuestionBankView, type QuestionRow } from "@/modules/exams/components/exam-views";
import {
  createQuestionCategory,
  renameQuestionCategory,
  deleteQuestionCategory,
} from "@/modules/exams/actions";
import { requireCountryScope } from "@/modules/countries/lib";
import { ActionButton } from "@/components/action-buttons";
import { InlineRename } from "@/components/inline-rename";
import type { Country, ExamQuestion, Merchant } from "@/lib/types";

// The bank is a shelf of question sets. Landing here shows the sets; opening one
// shows its questions.
export default async function AdminQuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; generated?: string; saved?: string; category?: string }>;
}) {
  const { cu } = await requirePerm("exams", "view");
  const { error, generated, saved, category = "" } = await searchParams;
  const { active } = await requireCountryScope();

  const [{ data: cats }, { data: merchants }, { data: countries }] = await Promise.all([
    db()
      .from("question_categories")
      .select("id, name")
      .eq("country_id", active?.id ?? "")
      .order("sort")
      .order("name"),
    db().from("merchants").select("*").eq("status", "active").order("name"),
    db().from("countries").select("*").eq("active", true).order("sort"),
  ]);
  const categories = ((cats ?? []) as { id: string; name: string }[]).map((c) => ({ id: c.id, label: c.name }));
  const open = category === "none" ? { id: "none", label: "Not in a set" } : categories.find((c) => c.id === category);

  let questionQuery = db().from("exam_questions").select("*").order("sort").order("created_at");
  if (active) questionQuery = questionQuery.or(`country_id.is.null,country_id.eq.${active.id}`);
  if (category === "none") questionQuery = questionQuery.is("category_id", null);
  else if (category) questionQuery = questionQuery.eq("category_id", category);
  // Only the open set's questions are needed; the landing view just counts them.
  const { data: questions } = open
    ? await questionQuery
    : await questionQuery.select("id, category_id");

  const wls = (merchants ?? []) as Merchant[];
  const cs = (countries ?? []) as Country[];
  const wlName = new Map(wls.map((m) => [m.id, m.name]));
  const cName = new Map(cs.map((c) => [c.id, `${c.flag} ${c.name}`]));

  const counts: Record<string, number> = {};
  let uncategorised = 0;
  for (const q of (questions ?? []) as { category_id: string | null }[]) {
    if (q.category_id) counts[q.category_id] = (counts[q.category_id] ?? 0) + 1;
    else uncategorised++;
  }

  const rows: QuestionRow[] = open
    ? ((questions ?? []) as ExamQuestion[]).map((q) => ({
        ...q,
        editable: true,
        scope_label: `${q.merchant_id ? wlName.get(q.merchant_id) ?? "?" : "All white labels"} · ${
          q.country_id ? cName.get(q.country_id) ?? "?" : "All countries"
        }`,
      }))
    : [];

  const canEdit = Boolean(can(cu, "exams", "edit"));

  return (
    <QuestionBankView
      base="/admin/exams"
      error={error}
      generated={generated}
      saved={saved}
      canAdd={Boolean(can(cu, "exams", "add"))}
      canEdit={canEdit}
      canDelete={Boolean(can(cu, "exams", "delete"))}
      questions={rows}
      merchants={wls.map((m) => ({ id: m.id, label: m.name }))}
      countries={cs.map((c) => ({ id: c.id, label: `${c.flag} ${c.name}` }))}
      categories={categories}
      category={open ?? null}
      categoryCounts={counts}
      uncategorised={uncategorised}
      categoryForm={
        canEdit && active ? (
          <form
            action={createQuestionCategory}
            className="card grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-end"
          >
            <input type="hidden" name="country_id" value={active.id} />
            <div>
              <label className="mb-1 block text-xs text-muted">New Question Set</label>
              <input name="name" className="input" placeholder="e.g. Account Opening" required />
            </div>
            <ActionButton icon="plus" tip="Create this question set" label="Add Set" variant="primary" />
          </form>
        ) : null
      }
      setActions={(c) =>
        canEdit ? (
          <>
            <InlineRename
              action={renameQuestionCategory}
              value={c.label}
              hidden={{ id: c.id }}
              label={c.label}
            />
            {can(cu, "exams", "delete") && (
              <form action={deleteQuestionCategory}>
                <input type="hidden" name="id" value={c.id} />
                <ActionButton icon="trash" tip={`Delete ${c.label}`} variant="danger" />
              </form>
            )}
          </>
        ) : null
      }
    />
  );
}
