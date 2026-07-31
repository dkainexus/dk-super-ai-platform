"use client";

/* eslint-disable @next/next/no-img-element */
import { useRef } from "react";
import { uploadMerchantLogo, removeMerchantLogo } from "@/modules/merchants/actions-merchant";

// Same manners as the profile picture: click the tile to pick a new logo
// (uploads straight away), × on the corner removes it.
export function LogoEditor({ logoUrl, initial }: { logoUrl: string | null; initial: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative h-24 w-24 shrink-0">
      <form ref={formRef} action={uploadMerchantLogo}>
        <input
          ref={fileRef}
          name="logo"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={() => formRef.current?.requestSubmit()}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          title="Click to change the logo"
          className="group relative block h-24 w-24 overflow-hidden rounded-2xl ring-1 ring-white/10 transition-shadow hover:ring-accent"
        >
          {logoUrl ? (
            <img src={logoUrl} alt="logo" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent to-[#8b5cf6] text-3xl font-bold text-white">
              {initial}
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[10px] font-medium uppercase tracking-wide text-white opacity-0 transition-opacity group-hover:opacity-100">
            Change
          </span>
        </button>
      </form>
      {logoUrl && (
        <form action={removeMerchantLogo} className="absolute -right-1.5 -top-1.5">
          <button
            type="submit"
            title="Remove the logo"
            className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-sm leading-none text-muted shadow transition-colors hover:border-danger hover:text-danger"
          >
            ×
          </button>
        </form>
      )}
    </div>
  );
}
