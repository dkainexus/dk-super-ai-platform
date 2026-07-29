import Link from "next/link";
import { createExam, updateExam, saveExamContent, deleteExam, generateQuestions, reorderExams } from "../actions";
import { ExamModePicker, type CategoryOption } from "./mode-picker";
import { QuestionSetEditor } from "./question-set-editor";
import { GenerateButton } from "./generate-button";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { ActionButton, SaveButton } from "@/components/action-buttons";
import { MoneyInput } from "@/components/money-input";
import { DragReorder } from "@/components/drag-reorder";
import { TableToolbar } from "@/components/data-table";
import type { Exam, ExamQuestion } from "@/lib/types";

// Shared server-side views for the Exams module, used by both /admin and /m
// thin route pages (the pages fetch scope-appropriate data and render these).

export type Option = { id: string; label: string };
export type ExamStats = { attempts: number; passed: number; failed: number; pending: number };
export type ExamRow = Exam & { question_count: number; scope_label: string; stats?: ExamStats };
export type QuestionRow = ExamQuestion & { scope_label: string; editable: boolean };

export function ExamsIndexView({
  base,
  error,
  canAdd,
  exams,
  merchants,
  countries,
  categories = [],
  canEdit = false,
}: {
  base: string;
  error?: string;
  canAdd: boolean;
  exams: ExamRow[];
  merchants?: Option[];
  countries?: Option[];
  categories?: CategoryOption[];
  canEdit?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Exams</h1>
          <p className="mt-1 text-sm text-muted">
            Exam papers taken in the mobile app — essays are graded by the AI examiner.
          </p>
        </div>
        <Link
          href={`${base}/questions`}
          className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:border-accent"
        >
          Question Bank →
        </Link>
      </div>
      <ErrorBanner message={error} />

      {canAdd && (
        <form action={createExam} className="card grid gap-3 p-5 sm:grid-cols-2">
          <h2 className="text-sm font-semibold sm:col-span-2">New exam</h2>
          <div>
            <label className="mb-1 block text-xs text-muted">Title</label>
            <input name="title" className="input" placeholder="e.g. Company Registration Basics" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Description</label>
            <input name="description" className="input" placeholder="Optional" />
          </div>
          {merchants && (
            <div>
              <label className="mb-1 block text-xs text-muted">White Label</label>
              <select name="merchant_id" className="input">
                <option value="">All white labels</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          )}
          <ExamModePicker categories={categories}>
            <div>
              <label className="mb-1 block text-xs text-muted">Pass score %</label>
              <input name="pass_score" type="number" min={0} max={100} defaultValue={70} className="input mono-num" />
            </div>
          </ExamModePicker>
          <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-[12rem_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-xs text-muted">Retake wait (minutes)</label>
              <input name="retake_wait_minutes" type="number" min={0} defaultValue={0} className="input mono-num" />
            </div>
            <ActionButton icon="plus" tip="Create this exam" label="Create Exam" variant="primary" />
          </div>
        </form>
      )}

      {exams.length === 0 && <p className="card px-5 py-6 text-sm text-muted">No exams yet.</p>}
      <DragReorder ids={exams.map((e) => e.id)} onReorder={reorderExams} canEdit={canEdit}>
        {exams.map((e) => (
          <Link
            key={e.id}
            href={`${base}/${e.id}`}
            className="card flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-surface-raised"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{e.title}</p>
              <p className="text-xs text-muted">
                {e.scope_label} ·{" "}
                {(e as ExamRow & { mode?: string }).mode === "ai_interview"
                  ? "AI interview — pass / fail"
                  : `${e.question_count} questions · pass ${e.pass_score}%`}
              </p>
              {e.stats && (
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-success" title="Owners who passed">
                    {e.stats.passed} passed
                  </span>
                  <span className="rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 text-danger" title="Owners who failed">
                    {e.stats.failed} failed
                  </span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-muted" title="Attempts still being marked">
                    {e.stats.pending} in progress
                  </span>
                </p>
              )}
            </div>
            <ActiveTag active={e.published} on="Published" off="Draft" />
          </Link>
        ))}
      </DragReorder>
    </div>
  );
}

export function QuestionBankView({
  base,
  error,
  generated,
  saved,
  canAdd,
  canEdit,
  canDelete,
  questions,
  merchants,
  countries,
  categories = [],
  category,
  categoryCounts = {},
  uncategorised = 0,
  categoryForm,
}: {
  base: string;
  error?: string;
  generated?: string;
  saved?: string;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  questions: QuestionRow[];
  merchants?: Option[];
  countries?: Option[];
  categories?: CategoryOption[];
  /** The set being looked at; absent means the list of sets. */
  category?: { id: string; label: string } | null;
  categoryCounts?: Record<string, number>;
  uncategorised?: number;
  /** Add / rename / delete controls, rendered by the page. */
  categoryForm?: React.ReactNode;
}) {
  const back = category ? `${base}/questions?category=${category.id}` : `${base}/questions`;
  return (
    <div className="space-y-6">
      <div>
        <Link
          href={category ? `${base}/questions` : base}
          className="text-xs text-muted hover:text-foreground"
        >
          ← {category ? "Question Bank" : "Exams"}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">
          {category ? category.label : "Question Bank"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {category
            ? "Choice questions are auto-marked; essay questions are graded by the AI examiner."
            : "Questions live in sets. An exam picks one set and asks all of it — open a set to work on its questions."}
        </p>
      </div>
      <ErrorBanner message={error} />
      {generated && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          ✨ AI generated {generated} questions — review them below and edit anything that needs polish.
        </p>
      )}
      {saved && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          {saved} question{saved === "1" ? "" : "s"} saved.
        </p>
      )}

      {!category ? (
        <>
          {categoryForm}

          <TableToolbar count={categories.length} noun="question set" />

          <div className="card divide-y divide-border">
            {categories.length === 0 && (
              <p className="px-5 py-6 text-sm text-muted">
                No question sets yet{canAdd ? " — create one above." : "."}
              </p>
            )}
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`${base}/questions?category=${c.id}`}
                className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-surface-raised"
              >
                <span className="text-sm font-medium">{c.label}</span>
                <span className="mono-num text-xs text-muted">
                  {categoryCounts[c.id] ?? 0} question{(categoryCounts[c.id] ?? 0) === 1 ? "" : "s"} →
                </span>
              </Link>
            ))}
            {uncategorised > 0 && (
              <Link
                href={`${base}/questions?category=none`}
                className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-surface-raised"
              >
                <span className="text-sm font-medium text-muted">Not in a set</span>
                <span className="mono-num text-xs text-muted">
                  {uncategorised} question{uncategorised === 1 ? "" : "s"} →
                </span>
              </Link>
            )}
          </div>
        </>
      ) : (
        <>
          {canAdd && (
            <section className="card border-accent/30 p-5">
              <h2 className="mb-1 text-sm font-semibold">✨ Generate with AI</h2>
              <p className="mb-3 text-xs text-muted">
                Describe a topic and the AI writes the questions straight into this set.
              </p>
              <form action={generateQuestions} className="grid gap-3 sm:grid-cols-[1fr_6rem_9rem_9rem_auto]">
                {category && category.id !== "none" && (
                  <input type="hidden" name="category_id" value={category.id} />
                )}
                <div>
                  <label className="mb-1 block text-xs text-muted">Topic / source material</label>
                  <input name="topic" className="input" placeholder="e.g. Bank account safety rules for new members" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">How many</label>
                  <input name="count" type="number" min={1} max={20} defaultValue={5} className="input mono-num" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Type</label>
                  <select name="qtype" className="input">
                    <option value="choice">Choice</option>
                    <option value="essay">Essay (AI)</option>
                    <option value="mix">Mix</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Language</label>
                  <select name="language" className="input">
                    <option>English</option>
                    <option value="Thai">ไทย</option>
                    <option value="Vietnamese">Tiếng Việt</option>
                    <option value="Chinese">中文</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <GenerateButton />
                </div>
                {merchants && (
                  <div className="sm:col-span-full">
                    <label className="mb-1 block text-xs text-muted">White Label</label>
                    <select name="merchant_id" className="input">
                      <option value="">All white labels</option>
                      {merchants.map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </form>
            </section>
          )}

          <QuestionSetEditor
            questions={questions}
            categoryId={category && category.id !== "none" ? category.id : ""}
            back={back}
            canEdit={canEdit}
            canDelete={canDelete}
            merchantId={merchants ? "" : undefined}
          />
        </>
      )}
    </div>
  );
}

export function ExamDetailView({
  base,
  exam,
  error,
  saved,
  canEdit,
  canDelete,
  editable,
  questionOptions,
  videoOptions,
  attempts,
  merchants,
  countries,
  categories = [],
}: {
  base: string;
  exam: Exam;
  error?: string;
  saved?: string;
  canEdit: boolean;
  canDelete: boolean;
  /** false when a merchant views a platform-owned exam. */
  editable: boolean;
  questionOptions: { id: string; label: string; selected: boolean }[];
  videoOptions: { id: string; label: string; selected: boolean }[];
  attempts: { id: string; owner_name: string; score: number | null; passed: boolean | null; created_at: string }[];
  merchants?: Option[];
  countries?: Option[];
  categories?: CategoryOption[];
}) {
  const back = `${base}/${exam.id}`;
  const e = exam as Exam & { mode?: string; category_id?: string | null; ai_brief?: string | null };
  const isInterview = e.mode === "ai_interview";
  const canWrite = canEdit && editable;
  return (
    <div className="space-y-6">
      <div>
        <Link href={base} className="text-xs text-muted hover:text-foreground">← Exams</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{exam.title}</h1>
          <ActiveTag active={exam.published} on="Published" off="Draft" />
        </div>
      </div>
      <ErrorBanner message={error} />
      {saved && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Exam content saved.
        </p>
      )}

      {canWrite && (
        <form action={updateExam} className="card grid gap-3 p-5 sm:grid-cols-2">
          <input type="hidden" name="id" value={exam.id} />
          <input type="hidden" name="back" value={back} />
          <h2 className="text-sm font-semibold sm:col-span-2">Settings</h2>
          <div>
            <label className="mb-1 block text-xs text-muted">Title</label>
            <input name="title" defaultValue={exam.title} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Description</label>
            <input name="description" defaultValue={exam.description ?? ""} className="input" />
          </div>
          {merchants && (
            <div>
              <label className="mb-1 block text-xs text-muted">White Label</label>
              <select name="merchant_id" defaultValue={exam.merchant_id ?? ""} className="input">
                <option value="">All white labels</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          )}
          <ExamModePicker
            mode={e.mode}
            categoryId={e.category_id ?? ""}
            aiBrief={e.ai_brief ?? ""}
            categories={categories}
          >
            <div>
              <label className="mb-1 block text-xs text-muted">Pass %</label>
              <input name="pass_score" type="number" min={0} max={100} defaultValue={exam.pass_score} className="input mono-num" />
            </div>
          </ExamModePicker>
          <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-[10rem_auto_auto_auto_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-xs text-muted">Retake wait (min)</label>
              <input name="retake_wait_minutes" type="number" min={0} defaultValue={exam.retake_wait_minutes} className="input mono-num" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Reward on pass</label>
              <MoneyInput name="reward_amount" defaultValue={exam.reward_amount} />
            </div>
            <label className="flex items-center gap-2 pb-2 text-xs text-muted">
              <input type="checkbox" name="auto_notify" defaultChecked={exam.auto_notify} /> Notify
            </label>
            <div>
              <label className="mb-1 block text-xs text-muted">Sort</label>
              <input name="sort" type="number" defaultValue={exam.sort} className="input mono-num" />
            </div>
            <label className="flex items-center gap-2 pb-2 text-xs text-muted">
              <input type="checkbox" name="published" defaultChecked={exam.published} /> Published
            </label>
            <SaveButton tip="Save exam settings" />
            {canDelete && (
              <button
                type="submit"
                formAction={deleteExam}
                title="Delete this exam and its attempts"
                className="rounded-md border border-danger/40 px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10"
              >
                Delete
              </button>
            )}
          </div>
        </form>
      )}

      {canWrite && (
        <form action={saveExamContent} className="card space-y-4 p-5">
          <input type="hidden" name="id" value={exam.id} />
          <input type="hidden" name="back" value={back} />
          <div className={isInterview || e.category_id ? "hidden" : undefined}>
            <h2 className="text-sm font-semibold">Questions in this exam</h2>
            <p className="mt-0.5 text-xs text-muted">
              Ticked questions appear in the paper, in bank order.{" "}
              <Link href={`${base}/questions`} className="text-accent-strong hover:underline">
                Manage the bank →
              </Link>
            </p>
            <div className="mt-3 space-y-1.5">
              {questionOptions.length === 0 && (
                <p className="text-sm text-muted">The question bank is empty for this scope.</p>
              )}
              {questionOptions.map((q) => (
                <label key={q.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="question_ids" value={q.id} defaultChecked={q.selected} className="mt-0.5" />
                  <span>{q.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Required training videos</h2>
            <p className="mt-0.5 text-xs text-muted">
              The exam stays locked in the app until every ticked video is completed.
            </p>
            <div className="mt-3 space-y-1.5">
              {videoOptions.length === 0 && <p className="text-sm text-muted">No published videos in this scope.</p>}
              {videoOptions.map((v) => (
                <label key={v.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="video_ids" value={v.id} defaultChecked={v.selected} className="mt-0.5" />
                  <span>{v.label}</span>
                </label>
              ))}
            </div>
          </div>
          <SaveButton label="Save Content" tip="Save questions and unlock videos" />
        </form>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Recent Attempts</h2>
        <div className="card divide-y divide-border">
          {attempts.length === 0 && <p className="px-5 py-6 text-sm text-muted">No attempts yet.</p>}
          {attempts.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-medium">{a.owner_name}</p>
                <p className="text-xs text-muted">{new Date(a.created_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="mono-num text-sm">{a.score != null ? `${a.score}%` : "—"}</span>
                <ActiveTag active={Boolean(a.passed)} on="Passed" off="Failed" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
