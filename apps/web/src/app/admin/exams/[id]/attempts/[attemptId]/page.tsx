import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { overrideAttempt } from "@/modules/exams/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import type { Exam } from "@/lib/types";

type Attempt = {
  id: string;
  exam_id: string;
  score: number | null;
  passed: boolean | null;
  ai_passed: boolean | null;
  feedback: { overall?: string; per_question?: { question_id: string; score: number; comment: string }[] } | null;
  transcript: { role: string; content: string }[] | null;
  created_at: string;
  overridden_at: string | null;
  override_reason: string | null;
  owner: { full_name: string | null; ref: string | null } | null;
  reviewer: { name: string | null; username: string } | null;
};

// One attempt in full: for an interview that means the conversation the examiner
// had and the reasoning behind its verdict, which is what a human needs to see
// before overturning it.
export default async function AttemptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; attemptId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { cu } = await requirePerm("exams", "view");
  const { id, attemptId } = await params;
  const { error, saved } = await searchParams;

  const [{ data: attemptRow }, { data: examRow }] = await Promise.all([
    db()
      .from("exam_attempts")
      .select(
        "*, owner:owners(full_name, ref), reviewer:users!exam_attempts_overridden_by_fkey(name, username)"
      )
      .eq("id", attemptId)
      .eq("exam_id", id)
      .maybeSingle(),
    db().from("exams").select("*").eq("id", id).maybeSingle(),
  ]);
  if (!attemptRow || !examRow) notFound();
  const a = attemptRow as unknown as Attempt;
  const exam = examRow as Exam & { mode?: string };
  const isInterview = exam.mode === "ai_interview";
  const back = `/admin/exams/${id}/attempts/${attemptId}`;
  const canEdit = Boolean(can(cu, "exams", "edit"));

  const verdict = (passed: boolean | null) =>
    passed === true ? "Passed" : passed === false ? "Failed" : "Not marked";

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/admin/exams/${id}`} className="text-xs text-muted hover:text-foreground">← {exam.title}</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{a.owner?.full_name || "(unknown owner)"}</h1>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
              a.passed
                ? "border-success/40 bg-success/10 text-success"
                : a.passed === false
                  ? "border-danger/40 bg-danger/10 text-danger"
                  : "border-border text-muted"
            }`}
          >
            {verdict(a.passed)}
          </span>
          {a.overridden_at && (
            <span className="rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-[11px] text-warning">
              Changed by a reviewer
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">
          {a.owner?.ref && <span className="mono-num">{a.owner.ref} · </span>}
          {new Date(a.created_at).toLocaleString()}
          {!isInterview && a.score != null && ` · scored ${a.score}%`}
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved === "verdict" && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Verdict updated.
        </p>
      )}

      {a.feedback?.overall && (
        <section className="card p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            {isInterview ? "Examiner’s reasoning" : "Feedback"}
          </h2>
          <p className="whitespace-pre-wrap text-sm">{a.feedback.overall}</p>
        </section>
      )}

      {isInterview && (
        <section className="card p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Conversation</h2>
          {!a.transcript?.length ? (
            <p className="text-sm text-muted">No transcript was recorded.</p>
          ) : (
            <div className="space-y-2">
              {a.transcript.map((l, i) => (
                <div key={i} className={l.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <p
                    className={`max-w-[80%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                      l.role === "user"
                        ? "bg-accent text-background"
                        : "border border-border bg-surface-raised text-foreground"
                    }`}
                  >
                    {l.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {a.overridden_at && (
        <section className="card p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Reviewer&apos;s change</h2>
          <p className="text-sm">
            The examiner said <b>{verdict(a.ai_passed)}</b>; {a.reviewer?.name || a.reviewer?.username || "a reviewer"}{" "}
            changed it to <b>{verdict(a.passed)}</b> on {new Date(a.overridden_at).toLocaleString()}.
          </p>
          {a.override_reason && <p className="mt-1 text-sm text-muted">“{a.override_reason}”</p>}
        </section>
      )}

      {canEdit && (
        <section className="card p-5">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Change the verdict</h2>
          <p className="mb-4 text-xs text-muted">
            Read the conversation first. The examiner&apos;s original verdict is kept on the record either way, and
            turning a fail into a pass pays the exam reward.
          </p>
          <form action={overrideAttempt} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="back" value={back} />
            <div>
              <label className="mb-1 block text-xs text-muted">Why</label>
              <input name="reason" className="input" placeholder="e.g. answers were fine, the examiner misread them" required />
            </div>
            <ActionButton
              icon="check"
              tip="Mark this attempt as passed"
              label="Pass"
              variant="success"
              name="passed"
              value="true"
            />
            <ActionButton
              icon="x"
              tip="Mark this attempt as failed"
              label="Fail"
              variant="danger"
              name="passed"
              value="false"
            />
          </form>
        </section>
      )}
    </div>
  );
}
