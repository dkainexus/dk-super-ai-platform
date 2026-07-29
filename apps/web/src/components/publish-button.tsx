"use client";

// Publish state as a single button: "Publish now" when it's a draft,
// "Published" while live (click to unpublish). No save step.

import { useFormStatus } from "react-dom";

export function PublishButton({ published }: { published: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      title={published ? "Unpublish — hide it from the app" : "Publish now — make it live in the app"}
      className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-70 ${
        published
          ? "border-success/50 bg-success/10 text-success hover:border-danger/60 hover:bg-danger/10 hover:text-danger"
          : "border-border bg-surface-raised text-muted hover:border-accent hover:text-accent-strong"
      }`}
    >
      {pending ? "…" : published ? (
        <>
          <span className="group-hover:hidden">● Published</span>
          <span className="hidden group-hover:inline">Unpublish</span>
        </>
      ) : (
        "Publish now"
      )}
    </button>
  );
}
