"use client";

// Drag-to-reorder wrapper for the bank list. Rows stay server-rendered and are
// passed through as children; the list reflows live while dragging and the new
// order is saved once on drop.

import { useRef, useState, useTransition, type ReactNode } from "react";
import { reorderBanks } from "../actions";

export function BankReorder({
  ids,
  countryId,
  canEdit,
  dense,
  children,
}: {
  ids: string[];
  countryId: string;
  canEdit: boolean;
  /** Table rows instead of cards: tighter spacing, divider lines */
  dense?: boolean;
  children: ReactNode[];
}) {
  const [order, setOrder] = useState<number[]>(ids.map((_, i) => i));
  // The drag handlers close over the order from their render, so the latest
  // arrangement lives in a ref — otherwise the first drop saves the old order.
  const latest = useRef<number[]>(ids.map((_, i) => i));
  const [dragging, setDragging] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const saved = useRef<string>(ids.join(","));

  // Live reflow: as the pointer crosses a row, move the dragged row into its
  // slot so what you see is what you get on drop.
  function hover(target: number) {
    if (dragging === null || dragging === target) return;
    setOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(dragging);
      const to = next.indexOf(target);
      if (from === -1 || to === -1 || from === to) return prev;
      next.splice(to, 0, ...next.splice(from, 1));
      latest.current = next;
      return next;
    });
  }

  function commit() {
    setDragging(null);
    const nextIds = latest.current.map((i) => ids[i]);
    if (nextIds.join(",") === saved.current) return;
    saved.current = nextIds.join(",");
    startTransition(() => {
      reorderBanks(countryId, nextIds);
    });
  }

  return (
    <div className={dense ? "divide-y divide-border" : "space-y-3"}>
      {order.map((i) => (
        <div
          key={ids[i]}
          onDragOver={(e) => {
            e.preventDefault();
            hover(i);
          }}
          onDrop={(e) => {
            e.preventDefault();
            commit();
          }}
          className={`flex gap-2 transition-[opacity,box-shadow] ${
            dense ? "items-center hover:bg-surface-raised" : "items-start rounded-xl"
          } ${dragging === i ? "opacity-60 shadow-[0_0_0_1px_var(--accent)]" : ""}`}
        >
          {canEdit && (
            <span
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                // Firefox needs data set for a drag to start at all
                e.dataTransfer.setData("text/plain", ids[i]);
                setDragging(i);
              }}
              onDragEnd={commit}
              title="Drag to reorder"
              className={`cursor-grab select-none px-1 text-lg leading-none text-muted transition-colors hover:text-foreground active:cursor-grabbing ${dense ? "" : "mt-5"}`}
            >
              ⠿
            </span>
          )}
          <div className="min-w-0 flex-1">{children[i]}</div>
        </div>
      ))}
    </div>
  );
}
