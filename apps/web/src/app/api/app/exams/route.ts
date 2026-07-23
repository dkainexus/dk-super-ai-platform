import { ownerFromRequest, unauthorized } from "@/lib/app-auth";
import { globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import { examsForOwner } from "@/modules/exams/lib";

// GET /api/app/exams → exams visible to this owner with unlock/attempt state.
export async function GET(req: Request): Promise<Response> {
  const owner = await ownerFromRequest(req);
  if (!owner) return unauthorized();

  const toggles = await globalModuleToggles();
  if (!moduleEnabledFor("exams", toggles, owner.merchant, owner.country)) {
    return Response.json({ exams: [] });
  }

  const exams = await examsForOwner(owner);
  return Response.json({
    exams: exams.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      question_count: e.question_count,
      pass_score: e.pass_score,
      required_videos: e.required_videos,
      unlocked: e.unlocked,
      attempts: e.attempts,
      best_score: e.best_score,
      passed: e.passed,
      can_take: e.can_take,
      wait_until: e.wait_until,
    })),
  });
}
