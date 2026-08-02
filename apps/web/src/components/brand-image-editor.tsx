"use client";

/* eslint-disable @next/next/no-img-element */
import { useRef } from "react";

// One editor for every brand picture slot: click the tile to pick (uploads on
// selection), × removes. `shape` decides the frame — a wide wordmark strip or
// a square icon.
export function BrandImageEditor({
  imageUrl,
  initial,
  shape,
  fieldName,
  title,
  uploadAction,
  removeAction,
}: {
  imageUrl: string | null;
  initial: string;
  shape: "wide" | "square";
  fieldName: string;
  title: string;
  uploadAction: (formData: FormData) => Promise<void>;
  removeAction: () => Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const frame =
    shape === "wide"
      ? "h-16 w-48 rounded-xl"
      : "h-16 w-16 rounded-xl";

  return (
    <div className={`relative shrink-0 ${shape === "wide" ? "w-48" : "w-16"}`}>
      <form ref={formRef} action={uploadAction}>
        <input
          ref={fileRef}
          name={fieldName}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={() => formRef.current?.requestSubmit()}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          title={`Click to change the ${title}`}
          className={`group relative block overflow-hidden ring-1 ring-white/10 transition-shadow hover:ring-accent ${frame} bg-surface-raised`}
        >
          {imageUrl ? (
            <img src={imageUrl} alt={title} className="h-full w-full object-contain p-1.5" />
          ) : shape === "square" ? (
            <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent to-[#8b5cf6] text-xl font-bold text-white">
              {initial}
            </span>
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs text-muted">No {title} yet</span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[10px] font-medium uppercase tracking-wide text-white opacity-0 transition-opacity group-hover:opacity-100">
            Change
          </span>
        </button>
      </form>
      {imageUrl && (
        <form action={removeAction} className="absolute -right-1.5 -top-1.5">
          <button
            type="submit"
            title={`Remove the ${title}`}
            className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-xs leading-none text-muted shadow transition-colors hover:border-danger hover:text-danger"
          >
            ×
          </button>
        </form>
      )}
    </div>
  );
}
