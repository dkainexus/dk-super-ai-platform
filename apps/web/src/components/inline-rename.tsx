"use client";

// A pencil button that turns a row's name into an input in place. The row stays
// a link the rest of the time, so opening it is still one click.

import { useState } from "react";
import { ActionButton, SaveButton } from "@/components/action-buttons";

export function InlineRename({
  action,
  value,
  hidden,
  label,
}: {
  action: (formData: FormData) => Promise<void>;
  value: string;
  /** Extra fields the action needs (id, back path). */
  hidden: Record<string, string>;
  /** What is being renamed, for the tooltip. */
  label: string;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <ActionButton
        icon="edit"
        tip={`Rename ${label}`}
        type="button"
        onClick={() => setEditing(true)}
      />
    );
  }

  return (
    <form action={action} className="flex items-center gap-2">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input
        name="name"
        defaultValue={value}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
        }}
        className="input w-48 py-1.5 text-sm"
      />
      <SaveButton tip={`Save the new name for ${label}`} label="" />
      <button
        type="button"
        onClick={() => setEditing(false)}
        title="Leave the name as it was"
        className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted hover:border-accent hover:text-foreground"
      >
        ✕
      </button>
    </form>
  );
}
