import { ownerFromRequest, unauthorized } from "@/lib/app-auth";
import { db } from "@/lib/supabase";
import { examsForOwner, interviewTurn, type InterviewMessage } from "@/modules/exams/lib";
import { grantReward } from "@/modules/wallet/lib";

// POST /api/app/exams/:id/interview — one turn of the AI interview. Send the
// conversation so far; get the examiner's next line back, or its verdict.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const owner = await ownerFromRequest(req);
  if (!owner) return unauthorized();
  const { id } = await params;

  const exams = await examsForOwner(owner);
  const exam = exams.find((e) => e.id === id);
  if (!exam) return Response.json({ error: "Not found" }, { status: 404 });
  if ((exam as { mode?: string }).mode !== "ai_interview")
    return Response.json({ error: "This exam is not an interview" }, { status: 400 });
  if (!exam.can_take) {
    return Response.json(
      { error: exam.unlocked ? "Please wait before retaking this exam" : "Complete the required training videos first" },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { messages?: InterviewMessage[] };
  const messages = (body.messages ?? []).slice(-40);

  const turn = await interviewTurn(exam, messages);
  if (!turn.done) return Response.json({ reply: turn.reply, done: false });

  const transcript = [...messages, { role: "assistant" as const, content: turn.reply || turn.reason }];
  const { data: attempt } = await db()
    .from("exam_attempts")
    .insert({
      exam_id: exam.id,
      owner_id: owner.id,
      answers: [],
      score: null,
      passed: turn.passed === true,
      // Kept separately so a later human override still shows what the AI said.
      ai_passed: turn.passed === true,
      feedback: { overall: turn.reason, per_question: [] },
      transcript,
    })
    .select("id")
    .single();

  if (turn.passed === true) {
    // A failed reward must never fail the interview.
    try {
      await grantReward(owner, {
        kind: "exam",
        id: exam.id,
        title: exam.title,
        reward_amount: (exam as { reward_amount?: number | null }).reward_amount ?? null,
        auto_notify: (exam as { auto_notify?: boolean }).auto_notify ?? true,
      });
    } catch {
      // ignored
    }
  }

  return Response.json({
    reply: turn.reply,
    done: true,
    passed: turn.passed === true,
    reason: turn.reason,
    attempt_id: attempt?.id ?? null,
  });
}
