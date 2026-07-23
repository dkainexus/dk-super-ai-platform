"use client";

// Video upload form: browser → Supabase Storage direct upload (signed URL),
// with client-side duration probe + poster frame capture. Only metadata goes
// through server actions, so uploads are not limited by the server body size.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createTrainingUpload, saveTrainingVideo } from "../actions";

type Option = { id: string; label: string };

function putWithProgress(url: string, file: Blob, contentType: string, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Upload failed (network)"));
    xhr.send(file);
  });
}

/** Probe duration and grab a poster frame from the local file. */
function probeVideo(file: File): Promise<{ duration: number | null; thumb: Blob | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "metadata";
    video.src = url;
    const done = (duration: number | null, thumb: Blob | null) => {
      URL.revokeObjectURL(url);
      resolve({ duration, thumb });
    };
    video.onerror = () => done(null, null);
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? Math.round(video.duration) : null;
      video.currentTime = Math.min(1, (video.duration || 2) / 2);
      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          const w = 480;
          canvas.width = w;
          canvas.height = Math.round((video.videoHeight / video.videoWidth) * w) || 270;
          canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => done(duration, blob), "image/jpeg", 0.8);
        } catch {
          done(duration, null);
        }
      };
      setTimeout(() => done(duration, null), 5000); // seek can hang on odd codecs
    };
  });
}

export function TrainingUploadForm({
  merchants,
  countries,
}: {
  /** Platform side only — merchant users upload into their own workspace. */
  merchants?: Option[];
  countries?: Option[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file") as File | null;
    const title = String(fd.get("title") ?? "").trim();
    if (!title) return setError("Please enter a title");
    if (!file || file.size === 0) return setError("Please choose a video file");

    setBusy(true);
    setPct(0);
    try {
      const ext = file.name.includes(".") ? file.name.split(".").pop()! : "mp4";
      const upload = await createTrainingUpload({ kind: "video", ext });
      if ("error" in upload) throw new Error(upload.error);
      await putWithProgress(upload.url, file, file.type || "video/mp4", setPct);

      const { duration, thumb } = await probeVideo(file);
      let thumbPath: string | null = null;
      if (thumb) {
        const t = await createTrainingUpload({ kind: "thumb", ext: "jpg" });
        if (!("error" in t)) {
          await putWithProgress(t.url, thumb, "image/jpeg", () => {});
          thumbPath = t.path;
        }
      }

      const saved = await saveTrainingVideo({
        title,
        description: String(fd.get("description") ?? ""),
        merchantId: String(fd.get("merchant_id") ?? "") || null,
        countryId: String(fd.get("country_id") ?? "") || null,
        videoPath: upload.path,
        thumbPath,
        durationSeconds: duration,
        published: fd.get("published") === "on",
      });
      if ("error" in saved) throw new Error(saved.error);
      form.reset();
      setFileName(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="card space-y-3 p-5">
      <h2 className="text-sm font-semibold">Upload video</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-muted">Title</label>
          <input name="title" className="input" placeholder="e.g. Company registration walkthrough" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-muted">Description</label>
          <textarea name="description" rows={2} className="input" placeholder="Optional" />
        </div>
        {merchants && (
          <div>
            <label className="mb-1 block text-xs text-muted">White Label</label>
            <select name="merchant_id" className="input">
              <option value="">All white labels</option>
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
        )}
        {countries && (
          <div>
            <label className="mb-1 block text-xs text-muted">Country</label>
            <select name="country_id" className="input">
              <option value="">All countries</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-muted">Video file</label>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted hover:border-accent hover:text-foreground">
            <input
              type="file"
              name="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
            <span>{fileName ?? "Choose a video file (mp4 recommended)…"}</span>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="published" defaultChecked /> Publish immediately
        </label>
      </div>

      {busy && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>Uploading…</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}

      <button type="submit" disabled={busy} className="btn-primary">
        {busy ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}
