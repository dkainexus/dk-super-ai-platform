import "server-only";
import { db } from "@/lib/supabase";
import { aiComplete } from "@/modules/ai/lib";
import type { Exam, ExamAttempt, ExamQuestion, Owner } from "@/lib/types";

// ---------- Owner-facing queries ----------

export type OwnerExam = Exam & {
  question_count: number;
  required_videos: { id: string; title: string; completed: boolean }[];
  unlocked: boolean;
  attempts: number;
  best_score: number | null;
  passed: boolean;
  last_attempt_at: string | null;
  can_take: boolean;
  wait_until: string | null;
};

/** Published exams visible to an owner, with unlock + attempt state. */
export async function examsForOwner(owner: Owner): Promise<OwnerExam[]> {
  const { data: exams } = await db()
    .from("exams")
    .select("*, items:exam_items(question_id), videos:exam_videos(video_id)")
    .eq("published", true)
    .or(`merchant_id.is.null,merchant_id.eq.${owner.merchant_id}`)
    .or(`country_id.is.null,country_id.eq.${owner.country_id}`)
    .order("sort")
    .order("created_at");
  const list = (exams ?? []) as (Exam & {
    items: { question_id: string }[];
    videos: { video_id: string }[];
  })[];
  if (list.length === 0) return [];

  const videoIds = [...new Set(list.flatMap((e) => e.videos.map((v) => v.video_id)))];
  const [{ data: videoRows }, { data: progress }, { data: attempts }] = await Promise.all([
    videoIds.length
      ? db().from("training_videos").select("id, title").in("id", videoIds)
      : Promise.resolve({ data: [] }),
    videoIds.length
      ? db()
          .from("training_progress")
          .select("video_id, completed_at")
          .eq("owner_id", owner.id)
          .in("video_id", videoIds)
      : Promise.resolve({ data: [] }),
    db()
      .from("exam_attempts")
      .select("exam_id, score, passed, created_at")
      .eq("owner_id", owner.id)
      .order("created_at", { ascending: false }),
  ]);
  const videoTitle = new Map(((videoRows ?? []) as { id: string; title: string }[]).map((v) => [v.id, v.title]));
  const completedSet = new Set(
    ((progress ?? []) as { video_id: string; completed_at: string | null }[])
      .filter((p) => p.completed_at)
      .map((p) => p.video_id)
  );
  const attemptRows = (attempts ?? []) as { exam_id: string; score: number | null; passed: boolean | null; created_at: string }[];

  const now = Date.now();
  return list.map((e) => {
    const required = e.videos.map((v) => ({
      id: v.video_id,
      title: videoTitle.get(v.video_id) ?? "(deleted video)",
      completed: completedSet.has(v.video_id),
    }));
    const unlocked = required.every((v) => v.completed);
    const mine = attemptRows.filter((a) => a.exam_id === e.id);
    const best = mine.reduce<number | null>(
      (acc, a) => (a.score == null ? acc : acc == null ? Number(a.score) : Math.max(acc, Number(a.score))),
      null
    );
    const passed = mine.some((a) => a.passed);
    const last = mine[0]?.created_at ?? null;
    const waitMs = e.retake_wait_minutes * 60_000;
    const waitUntil = last && waitMs > 0 ? new Date(new Date(last).getTime() + waitMs) : null;
    const waiting = Boolean(waitUntil && waitUntil.getTime() > now);
    return {
      ...e,
      question_count: e.items.length,
      required_videos: required,
      unlocked,
      attempts: mine.length,
      best_score: best,
      passed,
      last_attempt_at: last,
      can_take: unlocked && !waiting && e.items.length > 0,
      wait_until: waiting && waitUntil ? waitUntil.toISOString() : null,
    };
  });
}

/** Active questions of an exam, in paper order. */
export async function examQuestions(examId: string): Promise<ExamQuestion[]> {
  const { data } = await db()
    .from("exam_items")
    .select("sort, question:exam_questions(*)")
    .eq("exam_id", examId)
    .order("sort");
  return ((data ?? []) as unknown as { sort: number; question: ExamQuestion }[])
    .map((r) => r.question)
    .filter((q) => q && q.active);
}

// ---------- Grading ----------

export type SubmittedAnswer = { question_id: string; answer_index?: number; answer_text?: string };

export type GradeResult = {
  score: number; // percent
  passed: boolean;
  feedback: NonNullable<ExamAttempt["feedback"]>;
};

/** Grade an attempt: choices locally, essays via the configured AI. */
export async function gradeAttempt(
  exam: Exam,
  questions: ExamQuestion[],
  answers: SubmittedAnswer[]
): Promise<GradeResult> {
  const byId = new Map(answers.map((a) => [a.question_id, a]));
  const per: { question_id: string; score: number; comment: string }[] = [];
  let earned = 0;
  let total = 0;

  const essays: { q: ExamQuestion; answer: string }[] = [];
  for (const q of questions) {
    total += q.points;
    const a = byId.get(q.id);
    if (q.type === "choice") {
      const ok = a?.answer_index != null && a.answer_index === q.correct_index;
      if (ok) earned += q.points;
      per.push({
        question_id: q.id,
        score: ok ? 100 : 0,
        comment: ok
          ? "Correct."
          : `Incorrect — the right answer is: ${q.options[q.correct_index ?? 0] ?? "?"}`,
      });
    } else {
      essays.push({ q, answer: (a?.answer_text ?? "").trim() });
    }
  }

  let overall = "";
  if (essays.length > 0) {
    const graded = await gradeEssays(essays);
    for (const { q } of essays) {
      const g = graded.results.find((r) => r.id === q.id) ?? { score: 0, comment: "Not graded." };
      const pct = Math.max(0, Math.min(100, Math.round(g.score)));
      earned += (q.points * pct) / 100;
      per.push({ question_id: q.id, score: pct, comment: g.comment });
    }
    overall = graded.overall;
  }

  const score = total > 0 ? Math.round((earned / total) * 100) : 0;
  const passed = score >= exam.pass_score;
  if (!overall) {
    overall = passed
      ? `Great job — you scored ${score}% and passed.`
      : `You scored ${score}%. The pass mark is ${exam.pass_score}% — review the training and try again.`;
  }
  return { score, passed, feedback: { overall, per_question: per } };
}

async function gradeEssays(
  essays: { q: ExamQuestion; answer: string }[]
): Promise<{ results: { id: string; score: number; comment: string }[]; overall: string }> {
  const payload = essays.map(({ q, answer }) => ({
    id: q.id,
    question: q.question,
    reference_answer: q.model_answer ?? "(none provided — judge on correctness and completeness)",
    student_answer: answer || "(no answer)",
  }));
  const system = [
    "You are a fair, encouraging exam grader for a company training program.",
    "Grade each answer 0-100 against the reference answer (meaning matters, wording does not).",
    "An empty answer scores 0. Keep comments short (max 2 sentences), specific and constructive.",
    "Also write a 1-2 sentence overall summary for the student.",
    'Respond with ONLY minified JSON: {"results":[{"id":"...","score":0,"comment":"..."}],"overall":"..."}',
  ].join(" ");
  const raw = await aiComplete(system, [{ role: "user", content: JSON.stringify(payload) }]);
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned) as {
    results?: { id?: string; score?: number; comment?: string }[];
    overall?: string;
  };
  return {
    results: (parsed.results ?? []).map((r) => ({
      id: String(r.id ?? ""),
      score: Number(r.score ?? 0),
      comment: String(r.comment ?? ""),
    })),
    overall: String(parsed.overall ?? ""),
  };
}
