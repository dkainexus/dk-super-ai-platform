"use client";

/* eslint-disable @next/next/no-img-element */
import { useRef } from "react";
import { uploadAvatarAction, removeAvatarAction } from "@/app/actions/auth";

// The picture is the control: click it to pick a new one (uploads straight
// away), and the × in the corner removes it.
export function AvatarEditor({ avatarUrl, initials }: { avatarUrl: string | null; initials: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative h-16 w-16 shrink-0">
      <form ref={formRef} action={uploadAvatarAction}>
        <input
          ref={fileRef}
          name="avatar"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={() => formRef.current?.requestSubmit()}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          title="Click to change your picture"
          className="group relative block h-16 w-16 overflow-hidden rounded-full ring-1 ring-white/10 transition-shadow hover:ring-accent"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-accent-soft text-lg font-semibold text-accent-strong">
              {initials}
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[10px] font-medium uppercase tracking-wide text-white opacity-0 transition-opacity group-hover:opacity-100">
            Change
          </span>
        </button>
      </form>
      {avatarUrl && (
        <form action={removeAvatarAction} className="absolute -right-1 -top-1">
          <button
            type="submit"
            title="Remove the picture"
            className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-xs leading-none text-muted shadow transition-colors hover:border-danger hover:text-danger"
          >
            ×
          </button>
        </form>
      )}
    </div>
  );
}
