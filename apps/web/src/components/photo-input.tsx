"use client";

import { useState } from "react";

// File input that compresses images in the browser before upload.
// Server actions (and Vercel) cap request bodies at a few MB — raw phone
// photos are 3–10MB, so we downscale to ≤1600px JPEG before submitting.
// PDFs and small files pass through untouched.
const MAX_DIM = 1600;
const QUALITY = 0.82;
const SKIP_BELOW = 500 * 1024; // already small enough

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < SKIP_BELOW) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file; // fall back to the original if decoding fails
  }
}

export function PhotoInput({ name, accept = "image/*" }: { name: string; accept?: string }) {
  const [info, setInfo] = useState("");

  return (
    <>
      <input
        name={name}
        type="file"
        accept={accept}
        className="input"
        onChange={async (e) => {
          const input = e.currentTarget;
          const file = input.files?.[0];
          if (!file) {
            setInfo("");
            return;
          }
          const compressed = await compressImage(file);
          if (compressed !== file) {
            const dt = new DataTransfer();
            dt.items.add(compressed);
            input.files = dt.files;
            setInfo(`Compressed ${(file.size / 1024 / 1024).toFixed(1)}MB → ${(compressed.size / 1024).toFixed(0)}KB`);
          } else if (file.size > 4 * 1024 * 1024) {
            setInfo("This file is large — upload may fail. Please use a file under 4MB.");
          } else {
            setInfo("");
          }
        }}
      />
      {info && <p className="mt-1 text-xs text-muted">{info}</p>}
    </>
  );
}
