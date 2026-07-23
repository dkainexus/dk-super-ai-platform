"use client";

import { useFormStatus } from "react-dom";

export function GenerateButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      title="Let the AI write these questions into the bank"
      className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:bg-accent-strong disabled:opacity-50"
    >
      {pending ? (
        <>
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Generating…
        </>
      ) : (
        <>✨ Generate</>
      )}
    </button>
  );
}
