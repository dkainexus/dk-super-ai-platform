import Link from "next/link";
import { createExam, updateExam, saveExamContent, deleteExam, deleteQuestion } from "../actions";
import { QuestionForm } from "./question-form";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { ActionButton, SaveButton } from "@/components/action-buttons";
import type { Exam, ExamQuestion } from "@/lib/types";

// Shared server-side views for the Exams module, used by both /admin and /m
// thin route pages (the pages fetch scope-appropriate data and render these).

export type Option = { id: string; label: string };
export type ExamRow = Exam & { question_count: number; scope_label: string };
export type QuestionRow = ExamQuestion & { scope_label: string; editable: boolean };

export function ExamsIndexView({
  base,
  error,
  canAdd,
  exams,
  merchants,
  countries,
}: {
  base: string;
  error?: string;
  canAdd: boolean;
  exams: ExamRow[];
  merchants?: Option[];
  countries?: Option[];
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
          {countries && (
            <div>
              <label className="mb-1 block text-xs text-muted">Country</label>
              <select name="country_id" className="input">
                <option value="">All countries</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-[8rem_12rem_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-xs text-muted">Pass score %</label>
              <input name="pass_score" type="number" min={0} max={100} defaultValue={70} className="input mono-num" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Retake wait (minutes)</label>
              <input name="retake_wait_minutes" type="number" min={0} defaultValue={0} className="input mono-num" />
            </div>
            <ActionButton icon="plus" tip="Create this exam and pick questions next" label="Create Exam" variant="primary" />
          </div>
        </form>
      )}

      <div className="card divide-y divide-border">
        {exams.length === 0 && <p className="px-5 py-6 text-sm text-muted">No exams yet.</p>}
        {exams.map((e) => (
          <Link
            key={e.id}
            href={`${base}/${e.id}`}
            className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-surface-raised"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{e.title}</p>
              <p className="text-xs text-muted">
                {e.scope_label} · {e.question_count} questions · pass {e.pass_score}%
              </p>
            </div>
            <ActiveTag active={e.published} on="Published" off="Draft" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function QuestionBankView({
  base,
  error,
  canAdd,
  canEdit,
  canDelete,
  questions,
  merchants,
  countries,
}: {
  base: string;
  error?: string;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  questions: QuestionRow[];
  merchants?: Option[];
  countries?: Option[];
}) {
  const back = `${base}/questions`;
  return (
    <div className="space-y-6">
      <div>
        <Link href={base} className="text-xs text-muted hover:text-foreground">← Exams</Link>
        <h1 className="mt-1 text-xl font-semibold">Question Bank</h1>
        <p className="mt-1 text-sm text-muted">
          Choice questions are auto-marked; essay questions are graded by the AI examiner.
        </p>
      </div>
      <ErrorBanner message={error} />

      {canAdd && (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold">Add question</h2>
          <QuestionForm back={back} merchants={merchants} countries={countries} />
        </section>
      )}

      <div className="space-y-3">
        {questions.length === 0 && <p className="card px-5 py-6 text-sm text-muted">No questions yet.</p>}
        {questions.map((q) => (
          <details key={q.id} className="card p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{q.question}</p>
                <p className="text-xs text-muted">
                  {q.type === "choice" ? `Choice · ${q.options.length} options` : "Essay · AI graded"} ·{" "}
                  {q.points} pt · {q.scope_label}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ActiveTag active={q.active} />
              </div>
            </summary>
            {q.editable && canEdit ? (
              <div className="mt-4 border-t border-border pt-4">
                <QuestionForm question={q} back={back} />
                {canDelete && (
                  <form action={deleteQuestion} className="mt-3">
                    <input type="hidden" name="id" value={q.id} />
                    <input type="hidden" name="back" value={back} />
                    <button
                      type="submit"
                      title="Delete this question (removed from all exams)"
                      className="rounded-md border border-danger/40 px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10"
                    >
                      Delete
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <div className="mt-4 border-t border-border pt-4 text-sm text-muted">
                {q.type === "choice" ? (
                  <ul className="space-y-1">
                    {q.options.map((o, i) => (
                      <li key={i} className={i === q.correct_index ? "text-success" : undefined}>
                        {String.fromCharCode(65 + i)}. {o} {i === q.correct_index && "✓"}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Reference: {q.model_answer ?? "—"}</p>
                )}
                {!q.editable && <p className="mt-2 text-xs">Platform question — managed by the platform.</p>}
              </div>
            )}
          </details>
        ))}
      </div>
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
}) {
  const back = `${base}/${exam.id}`;
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
          {countries && (
            <div>
              <label className="mb-1 block text-xs text-muted">Country</label>
              <select name="country_id" defaultValue={exam.country_id ?? ""} className="input">
                <option value="">All countries</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-[7rem_10rem_5rem_auto_auto_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-xs text-muted">Pass %</label>
              <input name="pass_score" type="number" min={0} max={100} defaultValue={exam.pass_score} className="input mono-num" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Retake wait (min)</label>
              <input name="retake_wait_minutes" type="number" min={0} defaultValue={exam.retake_wait_minutes} className="input mono-num" />
            </div>
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
          <div>
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
