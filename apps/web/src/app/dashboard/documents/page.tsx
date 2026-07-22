import { requireBotStaff, canReview } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { reviewCandidateAction } from "@/app/actions/documents";

const DOC_LABELS: Record<string, string> = {
  photo_full_body: "Full-body Photo",
  id_front: "ID Front",
  id_back: "ID Back",
  tabian_baan: "Tabian Baan",
};

export default async function DocumentsPage() {
  const user = await requireBotStaff();
  const supabase = db();

  const { data: candidates } = await supabase
    .from("candidates")
    .select("*, groups(title, code)")
    .eq("status", "doc_review_pending")
    .order("created_at", { ascending: true });

  const candidateIds = (candidates ?? []).map((c) => c.id);
  const { data: submissions } = candidateIds.length
    ? await supabase
        .from("document_submissions")
        .select("*")
        .in("candidate_id", candidateIds)
        .eq("review_status", "pending")
    : { data: [] };

  const submissionsByCandidate = new Map<string, typeof submissions>();
  for (const sub of submissions ?? []) {
    const list = submissionsByCandidate.get(sub.candidate_id) ?? [];
    list.push(sub);
    submissionsByCandidate.set(sub.candidate_id, list);
  }

  return (
    <div>
      <h1 className="text-xl mb-4">Pending Applications ({candidates?.length ?? 0})</h1>

      {(candidates ?? []).length === 0 && (
        <p className="text-[var(--fg-muted)]">No pending applications.</p>
      )}

      <div className="grid gap-4">
        {(candidates ?? []).map((candidate) => (
          <div key={candidate.id} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium">{candidate.full_name || "(no name)"}</p>
                <p className="text-sm text-[var(--fg-muted)]">
                  {candidate.groups?.title || candidate.groups?.code}
                </p>
              </div>
              {canReview(user) && (
                <div className="flex gap-2">
                  <form action={reviewCandidateAction}>
                    <input type="hidden" name="candidateId" value={candidate.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <button type="submit" className="btn btn-success">
                      Approve
                    </button>
                  </form>
                  <form action={reviewCandidateAction}>
                    <input type="hidden" name="candidateId" value={candidate.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <button type="submit" className="btn btn-danger">
                      Reject
                    </button>
                  </form>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(submissionsByCandidate.get(candidate.id) ?? []).map((doc) => (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={doc.id} href={`/api/telegram-file/${doc.file_id}`} target="_blank" rel="noreferrer">
                  <img
                    src={`/api/telegram-file/${doc.file_id}`}
                    alt={DOC_LABELS[doc.doc_type] ?? doc.doc_type}
                    className="rounded border border-[var(--border)] w-full h-32 object-cover"
                  />
                  <p className="text-xs text-center mt-1 text-[var(--fg-muted)]">
                    {DOC_LABELS[doc.doc_type] ?? doc.doc_type}
                  </p>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
