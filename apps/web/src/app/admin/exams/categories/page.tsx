import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import {
  createQuestionCategory,
  renameQuestionCategory,
  deleteQuestionCategory,
} from "@/modules/exams/actions";
import { requireCountryScope } from "@/modules/countries/lib";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { AutoSaveInput } from "@/components/auto-save-input";
import { TableToolbar } from "@/components/data-table";

type Category = { id: string; name: string; exam_questions: { count: number }[] };

// Groups the question bank is sorted into. An exam in "draw from bank" mode
// pulls its questions from one category.
export default async function QuestionCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("exams", "view");
  const { error } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const { data } = await db()
    .from("question_categories")
    .select("id, name, exam_questions(count)")
    .eq("country_id", active.id)
    .order("sort")
    .order("name");
  const rows = (data ?? []) as unknown as Category[];
  const canEdit = Boolean(can(cu, "exams", "edit"));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/exams/questions" className="text-xs text-muted hover:text-foreground">← Question Bank</Link>
        <h1 className="mt-1 text-xl font-semibold">Question Categories</h1>
        <p className="mt-1 text-sm text-muted">
          Groups for the {active.name} question bank — an exam can draw its questions from one of them.
        </p>
      </div>
      <ErrorBanner message={error} />

      {canEdit && (
        <form action={createQuestionCategory} className="card grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <input type="hidden" name="country_id" value={active.id} />
          <div>
            <label className="mb-1 block text-xs text-muted">New Category</label>
            <input name="name" className="input" placeholder="e.g. Account Opening" required />
          </div>
          <ActionButton icon="plus" tip="Add this category" label="Add" variant="primary" />
        </form>
      )}

      <TableToolbar count={rows.length} noun="category" />

      <div className="card divide-y divide-border">
        {rows.length === 0 && <p className="px-5 py-6 text-sm text-muted">No categories yet.</p>}
        {rows.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            {canEdit ? (
              <AutoSaveInput
                action={renameQuestionCategory}
                name="name"
                value={c.name}
                hidden={{ id: c.id }}
                className="input min-w-48 flex-1 py-1.5 text-sm"
              />
            ) : (
              <span className="min-w-48 flex-1 text-sm">{c.name}</span>
            )}
            <span className="mono-num text-xs text-muted">{c.exam_questions?.[0]?.count ?? 0} questions</span>
            {can(cu, "exams", "delete") && (
              <form action={deleteQuestionCategory}>
                <input type="hidden" name="id" value={c.id} />
                <ActionButton icon="trash" tip={`Delete ${c.name}`} variant="danger" />
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
