"use client";

// Generic one-click image slot: choosing a file uploads it immediately and
// hovering reveals an ✕ to clear it. Used for logos and icons.

import { useRef } from "react";

export function ImagePicker({
  url,
  canEdit,
  uploadAction,
  removeAction,
  fieldName = "image",
  hidden,
  fallback = "🖼️",
  tip = "image",
  size = "h-11 w-11",
  rounded = "rounded-lg",
  fit = "object-contain",
}: {
  url: string | null;
  canEdit: boolean;
  uploadAction: (formData: FormData) => Promise<void>;
  removeAction: (formData: FormData) => Promise<void>;
  fieldName?: string;
  /** Extra hidden fields both actions need (ids, back path) */
  hidden: Record<string, string>;
  fallback?: string;
  tip?: string;
  size?: string;
  /** Tailwind radius class — a round avatar or a square tile. */
  rounded?: string;
  /** object-contain keeps logos whole; object-cover fills an avatar. */
  fit?: string;
}) {
  const uploadRef = useRef<HTMLFormElement>(null);

  const frame = (
    <div className={`flex ${size} items-center justify-center overflow-hidden ${rounded} border border-border bg-surface-raised`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className={`h-full w-full ${fit}`} />
      ) : (
        <span className="text-lg">{fallback}</span>
      )}
    </div>
  );

  if (!canEdit) return frame;

  const fields = Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);

  return (
    <div className={`group/img relative ${size}`}>
      <form ref={uploadRef} action={uploadAction}>
        {fields}
        <label title={url ? `Replace this ${tip}` : `Upload a ${tip}`} className="block cursor-pointer transition-opacity hover:opacity-80">
          <input
            type="file"
            name={fieldName}
            accept="image/*"
            className="hidden"
            onChange={() => uploadRef.current?.requestSubmit()}
          />
          {frame}
        </label>
      </form>
      {url && (
        <form action={removeAction} className="absolute -right-1.5 -top-1.5">
          {fields}
          <button
            type="submit"
            title={`Remove this ${tip}`}
            className="flex h-4 w-4 items-center justify-center rounded-full border border-border bg-surface text-[10px] text-muted opacity-0 transition-opacity hover:border-danger hover:text-danger group-hover/img:opacity-100"
          >
            ✕
          </button>
        </form>
      )}
    </div>
  );
}
