"use client";

// Bank logo: picking a file uploads it straight away; hovering the image
// reveals an ✕ to clear it. No save step.

import { useRef } from "react";
import { removeBankLogo, uploadBankLogo } from "../actions";

export function BankLogo({
  bankId,
  countryId,
  url,
  canEdit,
}: {
  bankId: string;
  countryId: string;
  url: string | null;
  canEdit: boolean;
}) {
  const uploadRef = useRef<HTMLFormElement>(null);

  const frame = (
    <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-raised">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-contain" />
      ) : (
        <span className="text-lg">🏦</span>
      )}
    </div>
  );

  if (!canEdit) return frame;

  return (
    <div className="group/logo relative h-11 w-11">
      {/* Upload — submits the moment a file is chosen */}
      <form ref={uploadRef} action={uploadBankLogo}>
        <input type="hidden" name="id" value={bankId} />
        <input type="hidden" name="country_id" value={countryId} />
        <label
          title={url ? "Replace this logo" : "Upload a logo"}
          className="block cursor-pointer transition-opacity hover:opacity-80"
        >
          <input
            type="file"
            name="logo"
            accept="image/*"
            className="hidden"
            onChange={() => uploadRef.current?.requestSubmit()}
          />
          {frame}
        </label>
      </form>

      {url && (
        <form action={removeBankLogo} className="absolute -right-1.5 -top-1.5">
          <input type="hidden" name="id" value={bankId} />
          <input type="hidden" name="country_id" value={countryId} />
          <button
            type="submit"
            title="Remove this logo"
            className="flex h-4.5 w-4.5 items-center justify-center rounded-full border border-border bg-surface text-[10px] text-muted opacity-0 transition-opacity hover:border-danger hover:text-danger group-hover/logo:opacity-100"
          >
            ✕
          </button>
        </form>
      )}
    </div>
  );
}
