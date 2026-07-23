"use client";

// APK release uploader: browser → Supabase Storage direct upload (signed
// URL) with progress, then metadata via server action.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createReleaseUpload, saveRelease } from "@/app/actions/app-releases";

function putWithProgress(url: string, file: Blob, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", "application/vnd.android.package-archive");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Upload failed (network)"));
    xhr.send(file);
  });
}

export function ReleaseUploadForm({ nextVersionCode }: { nextVersionCode: number }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("apk") as File | null;
    if (!file || file.size === 0) {
      setError("Please choose the APK file");
      return;
    }
    setBusy(true);
    setPct(0);
    try {
      const upload = await createReleaseUpload();
      if ("error" in upload) throw new Error(upload.error);
      await putWithProgress(upload.url, file, setPct);
      const saved = await saveRelease({
        versionCode: parseInt(String(fd.get("version_code") ?? "0"), 10),
        versionName: String(fd.get("version_name") ?? ""),
        notes: String(fd.get("notes") ?? ""),
        apkPath: upload.path,
        published: fd.get("published") === "on",
      });
      if ("error" in saved) throw new Error(saved.error);
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      {error && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger">{error}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-[8rem_10rem_1fr]">
        <div>
          <label className="mb-1 block text-xs text-muted">Version Code</label>
          <input
            name="version_code"
            type="number"
            min="1"
            step="1"
            defaultValue={nextVersionCode}
            className="input mono-num"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Version Name</label>
          <input name="version_name" placeholder="1.2.0" className="input mono-num" required />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Release Notes (shown in the update prompt)</label>
          <input name="notes" placeholder="Wallet, withdrawals and fixes" className="input" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="mb-1 block text-xs text-muted">APK File</label>
          <input name="apk" type="file" accept=".apk" className="input" required />
        </div>
        <label className="flex items-center gap-2 pt-4 text-sm text-muted">
          <input type="checkbox" name="published" defaultChecked className="h-4 w-4" /> Publish immediately
        </label>
        <button
          type="submit"
          disabled={busy}
          title="Upload the APK and register the release"
          className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity disabled:opacity-50"
        >
          {busy ? `Uploading… ${pct}%` : "Upload Release"}
        </button>
      </div>
      {busy && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
    </form>
  );
}
