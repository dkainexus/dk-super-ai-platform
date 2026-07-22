import "server-only";
import { db } from "./supabase";

export const ASSETS_BUCKET = "cms-assets";
export const DOCS_BUCKET = "owner-docs";

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

export function fileExt(file: File): string {
  const byMime = EXT_BY_MIME[file.type];
  if (byMime) return byMime;
  const dot = file.name.lastIndexOf(".");
  return dot >= 0 ? file.name.slice(dot + 1).toLowerCase().slice(0, 8) : "bin";
}

/** Uploads a browser File to a private bucket; returns the storage path. */
export async function uploadFile(bucket: string, path: string, file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await db()
    .storage.from(bucket)
    .upload(path, buf, { contentType: file.type || "application/octet-stream", upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

/** Signed URL for a private file (default 1h). Returns null for missing paths. */
export async function signedUrl(
  bucket: string,
  path: string | null | undefined,
  expiresIn = 3600
): Promise<string | null> {
  if (!path) return null;
  const { data } = await db().storage.from(bucket).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}
