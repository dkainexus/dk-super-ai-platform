import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { toggleRelease, deleteRelease } from "@/app/actions/app-releases";
import { ReleaseUploadForm } from "@/components/release-upload-form";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { ActionButton } from "@/components/action-buttons";

type Release = {
  id: string;
  version_code: number;
  version_name: string;
  notes: string | null;
  published: boolean;
  created_at: string;
};

// Mobile app releases: upload a new APK, publish it, and every app checks
// /api/app/version — users get an in-app update prompt with one-tap install.
export default async function AppReleasesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePerm("settings", "edit");
  const { error } = await searchParams;

  const { data: releases } = await db()
    .from("app_releases")
    .select("id, version_code, version_name, notes, published, created_at")
    .order("version_code", { ascending: false });
  const nextCode = ((releases ?? [])[0] as Release | undefined)?.version_code ?? 1;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/settings" className="text-xs text-muted hover:text-foreground">
          ← Settings
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Mobile App Releases</h1>
        <p className="mt-1 text-sm text-muted">
          Upload a new APK and publish it — every app shows an update prompt and installs it with one tap. The app
          always offers the highest published version.
        </p>
      </div>
      <ErrorBanner message={error} />

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold">New Release</h2>
        <ReleaseUploadForm nextVersionCode={nextCode + 1} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Releases</h2>
        <div className="card divide-y divide-border">
          {(releases ?? []).length === 0 && (
            <p className="px-5 py-6 text-sm text-muted">No releases yet.</p>
          )}
          {((releases ?? []) as Release[]).map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  v{r.version_name} <span className="mono-num text-xs text-muted">(code {r.version_code})</span>
                </p>
                <p className="truncate text-xs text-muted">
                  {r.notes || "—"} · {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ActiveTag active={r.published} on="Published" off="Draft" />
                <form action={toggleRelease}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="published" value={String(!r.published)} />
                  <ActionButton
                    icon="check"
                    tip={r.published ? "Unpublish — apps stop offering this version" : "Publish — apps start offering this version"}
                    label={r.published ? "Unpublish" : "Publish"}
                  />
                </form>
                <form action={deleteRelease}>
                  <input type="hidden" name="id" value={r.id} />
                  <ActionButton icon="trash" tip="Delete this release and its APK file" variant="danger" />
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
