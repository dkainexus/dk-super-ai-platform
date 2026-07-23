import { db } from "@/lib/supabase";
import { ownerFromRequest, unauthorized } from "@/lib/app-auth";
import { examsForOwner, examQuestions, gradeAttempt, type SubmittedAnswer } from "@/modules/exams/lib";
import { notifyOwner } from "@/modules/notifications/lib";

export const maxDuration = 60; // essay grading calls the AI

// POST /api/app/exams/:id/submit  { answers: [{question_id, answer_index?, answer_text?}] }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const owner = await ownerFromRequest(req);
  if (!owner) return unauthorized();
  const { id } = await params;

  let body: { answers?: SubmittedAnswer[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const answers = Array.isArray(body.answers) ? body.answers : [];

  const exams = await examsForOwner(owner);
  const exam = exams.find((e) => e.id === id);
  if (!exam) return Response.json({ error: "Not found" }, { status: 404 });
  if (!exam.can_take) {
    return Response.json(
      { error: exam.unlocked ? "Please wait before retaking this exam" : "Complete the required training videos first" },
      { status: 403 }
    );
  }

  const questions = await examQuestions(id);
  let result;
  try {
    result = await gradeAttempt(exam, questions, answers);
  } catch {
    return Response.json(
      { error: "The AI examiner is unavailable right now — please try submitting again in a moment" },
      { status: 503 }
    );
  }

  const { error } = await db().from("exam_attempts").insert({
    exam_id: id,
    owner_id: owner.id,
    answers,
    score: result.score,
    passed: result.passed,
    feedback: result.feedback,
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });

  const firstPass = result.passed && !exam.passed;
  if (firstPass) {
    await notifyOwner(
      owner.id,
      "exam",
      `You passed: ${exam.title} 🎉`,
      `Score ${result.score}% (pass mark ${exam.pass_score}%). Well done!`
    );
  }

  return Response.json({
    score: result.score,
    passed: result.passed,
    pass_score: exam.pass_score,
    feedback: result.feedback,
    questions: questions.map((q) => ({ id: q.id, question: q.question, type: q.type })),
  });
}
