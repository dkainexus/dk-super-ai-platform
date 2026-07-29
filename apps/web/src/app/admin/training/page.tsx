import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { signedUrl } from "@/lib/storage";
import { TRAINING_BUCKET, videoStats } from "@/modules/training/lib";
import { updateTrainingVideo,
  toggleTrainingPublished,
  reorderTrainingVideos, deleteTrainingVideo } from "@/modules/training/actions";
import { TrainingUploadForm } from "@/modules/training/components/upload-form";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { PublishButton } from "@/components/publish-button";
import { DragReorder } from "@/components/drag-reorder";
import { MoneyInput } from "@/components/money-input";
import { SaveButton } from "@/components/action-buttons";
import { fmtNum } from "@/lib/format";
import type { Country, Merchant, TrainingVideo } from "@/lib/types";
import { requireCountryScope } from "@/modules/countries/lib";

function fmtDuration(s: number | null): string {
  if (!s) return "";
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

// Training module (platform side): full video library across white labels.
export default async function AdminTrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("training", "view");
  const { error } = await searchParams;

  const { active } = await requireCountryScope();
  let videoQuery = db().from("training_videos").select("*").order("sort").order("created_at");
  if (active) videoQuery = videoQuery.or(`country_id.is.null,country_id.eq.${active.id}`);

  const [{ data: videos }, { data: merchants }, { data: countries }] = await Promise.all([
    videoQuery,
    db().from("merchants").select("*").eq("status", "active").order("name"),
    db().from("countries").select("*").eq("active", true).order("sort"),
  ]);
  const list = (videos ?? []) as TrainingVideo[];
  const wls = (merchants ?? []) as Merchant[];
  const cs = (countries ?? []) as Country[];

  const stats = await videoStats({ videoIds: list.map((v) => v.id), countryId: active?.id });
  const totals = [...stats.values()].reduce(
    (acc, s) => ({ watching: acc.watching + s.watching, completed: acc.completed + s.completed }),
    { watching: 0, completed: 0 }
  );

  const canAdd = can(cu, "training", "add");
  const canEdit = can(cu, "training", "edit");
  const canDelete = can(cu, "training", "delete");

  const thumbs = new Map<string, string | null>();
  const previews = new Map<string, string | null>();
  for (const v of list) {
    thumbs.set(v.id, await signedUrl(TRAINING_BUCKET, v.thumb_path, 3600));
    previews.set(v.id, await signedUrl(TRAINING_BUCKET, v.video_path, 3600));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Training</h1>
        <p className="mt-1 text-sm text-muted">
          Video library streamed to the mobile app. Screenshots and screen recording are blocked in the app.
        </p>
      </div>
      <ErrorBanner message={error} />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Videos", list.length],
          ["In progress", totals.watching],
          ["Completed", totals.completed],
        ].map(([label, value]) => (
          <div key={String(label)} className="card px-4 py-3">
            <p className="text-xs text-muted">{label}</p>
            <p className="mono-num mt-0.5 text-xl font-semibold">{fmtNum(Number(value))}</p>
          </div>
        ))}
      </div>

      {canAdd && (
        <TrainingUploadForm />
      )}

      {list.length === 0 && <p className="card px-5 py-6 text-sm text-muted">No training videos yet.</p>}
      <DragReorder ids={list.map((v) => v.id)} onReorder={reorderTrainingVideos} canEdit={Boolean(canEdit)}>
        {list.map((v) => (
          <div key={v.id} className="card p-4">
            <div className="flex gap-4">
              <a
                href={previews.get(v.id) ?? "#"}
                target="_blank"
                rel="noreferrer"
                title="Preview video"
                className="relative block h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-raised"
              >
                {thumbs.get(v.id) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbs.get(v.id)!} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-2xl">🎬</span>
                )}
                {v.duration_seconds ? (
                  <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] text-white mono-num">
                    {fmtDuration(v.duration_seconds)}
                  </span>
                ) : null}
              </a>
              <div className="hidden shrink-0 flex-col justify-center gap-1 sm:flex">
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted" title="Owners who started this video but have not finished">
                  {fmtNum(stats.get(v.id)?.watching ?? 0)} watching
                </span>
                <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] text-success" title="Owners who finished this video">
                  {fmtNum(stats.get(v.id)?.completed ?? 0)} completed
                </span>
              </div>

              {canEdit ? (
                <form action={updateTrainingVideo} className="grid flex-1 gap-3 sm:grid-cols-2">
                  <input type="hidden" name="id" value={v.id} />
                  <input type="hidden" name="back" value="/admin/training" />
                  <div>
                    <label className="mb-1 block text-xs text-muted">Title</label>
                    <input name="title" defaultValue={v.title} className="input" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted">Description</label>
                    <input name="description" defaultValue={v.description ?? ""} className="input" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-[1fr_7rem_auto_auto_auto] sm:items-end">
                    <div>
                      <label className="mb-1 block text-xs text-muted">White Label</label>
                      <select name="merchant_id" defaultValue={v.merchant_id ?? ""} className="input">
                        <option value="">All white labels</option>
                        {wls.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">Reward on finish</label>
                      <MoneyInput name="reward_amount" defaultValue={v.reward_amount} />
                    </div>
                    <label className="flex items-center gap-2 pb-2 text-xs text-muted">
                      <input type="checkbox" name="auto_notify" defaultChecked={v.auto_notify} /> Notify
                    </label>
                    <input type="hidden" name="published" value={v.published ? "on" : ""} />
                    <input type="hidden" name="sort" value={v.sort} />
                    <SaveButton tip="Save this video" />
                    {canDelete && (
                      <button
                        type="submit"
                        formAction={deleteTrainingVideo}
                        title="Delete video and file"
                        className="rounded-md border border-danger/40 px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                <div className="flex flex-1 items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{v.title}</p>
                    <p className="text-xs text-muted">{v.description}</p>
                  </div>
                  {canEdit ? (
                    <form action={toggleTrainingPublished}>
                      <input type="hidden" name="id" value={v.id} />
                      <input type="hidden" name="back" value="/admin/training" />
                      <input type="hidden" name="publish" value={v.published ? "0" : "1"} />
                      <PublishButton published={v.published} />
                    </form>
                  ) : (
                    <ActiveTag active={v.published} on="Published" off="Draft" />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </DragReorder>
    </div>
  );
}
