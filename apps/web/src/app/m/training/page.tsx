import { requireMerchantUser, requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { signedUrl } from "@/lib/storage";
import { activeCountry } from "@/modules/merchants/lib";
import { TRAINING_BUCKET } from "@/modules/training/lib";
import { updateTrainingVideo, deleteTrainingVideo } from "@/modules/training/actions";
import { TrainingUploadForm } from "@/modules/training/components/upload-form";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { SaveButton } from "@/components/action-buttons";
import type { TrainingVideo } from "@/lib/types";

function fmtDuration(s: number | null): string {
  if (!s) return "";
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

// Training module (portal side): platform videos + this white label's own
// uploads, scoped to the active country workspace.
export default async function MerchantTrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cu = await requireMerchantUser();
  await requirePerm("training", "view");
  const { active } = await activeCountry(cu);

  let q = db()
    .from("training_videos")
    .select("*")
    .or(`merchant_id.is.null,merchant_id.eq.${cu.merchant.id}`)
    .order("sort")
    .order("created_at");
  if (active) q = q.or(`country_id.is.null,country_id.eq.${active.id}`);
  const { data: videos } = await q;
  const list = (videos ?? []) as TrainingVideo[];
  const { error } = await searchParams;

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
        <h1 className="text-xl font-semibold">
          Training{active ? ` — ${active.flag || ""} ${active.name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Videos your owners see in the mobile app. Platform videos are managed by the platform.
        </p>
      </div>
      <ErrorBanner message={error} />

      {canAdd && <TrainingUploadForm />}

      <div className="space-y-3">
        {list.length === 0 && <p className="card px-5 py-6 text-sm text-muted">No training videos yet.</p>}
        {list.map((v) => {
          const own = v.merchant_id === cu.merchant.id;
          return (
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

                {own && canEdit ? (
                  <form action={updateTrainingVideo} className="grid flex-1 gap-3 sm:grid-cols-[1fr_1fr_5rem_auto_auto_auto] sm:items-end">
                    <input type="hidden" name="id" value={v.id} />
                    <input type="hidden" name="back" value="/m/training" />
                    <div>
                      <label className="mb-1 block text-xs text-muted">Title</label>
                      <input name="title" defaultValue={v.title} className="input" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">Description</label>
                      <input name="description" defaultValue={v.description ?? ""} className="input" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">Sort</label>
                      <input name="sort" type="number" defaultValue={v.sort} className="input mono-num" />
                    </div>
                    <label className="flex items-center gap-2 pb-2 text-xs text-muted">
                      <input type="checkbox" name="published" defaultChecked={v.published} /> Published
                    </label>
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
                  </form>
                ) : (
                  <div className="flex flex-1 items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{v.title}</p>
                      <p className="text-xs text-muted">{v.description}</p>
                      {!own && (
                        <span className="mt-1 inline-block rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">
                          Platform video
                        </span>
                      )}
                    </div>
                    <ActiveTag active={v.published} on="Published" off="Draft" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
