import { ownerFromRequest, unauthorized } from "@/lib/app-auth";
import { examsForOwner, examQuestions } from "@/modules/exams/lib";

// GET /api/app/exams/:id → the paper for taking (no correct answers included).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const owner = await ownerFromRequest(req);
  if (!owner) return unauthorized();
  const { id } = await params;

  const exams = await examsForOwner(owner);
  const exam = exams.find((e) => e.id === id);
  if (!exam) return Response.json({ error: "Not found" }, { status: 404 });
  if (!exam.can_take) {
    return Response.json(
      { error: exam.unlocked ? "Please wait before retaking this exam" : "Complete the required training videos first" },
      { status: 403 }
    );
  }

  let questions = await examQuestions(id);
  // Random draw: sample N questions per attempt when configured.
  if (exam.draw_count && exam.draw_count > 0 && exam.draw_count < questions.length) {
    const pool = [...questions];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    questions = pool.slice(0, exam.draw_count);
  }
  return Response.json({
    exam: { id: exam.id, title: exam.title, pass_score: exam.pass_score },
    questions: questions.map((q) => ({
      id: q.id,
      type: q.type,
      question: q.question,
      options: q.type === "choice" ? q.options : [],
      points: q.points,
    })),
  });
}
