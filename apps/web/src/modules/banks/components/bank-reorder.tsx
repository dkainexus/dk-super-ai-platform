"use client";

// Drag-to-reorder wrapper for the bank list. The rows themselves stay
// server-rendered and are simply passed through as children; dropping a row
// saves the new order straight away.

import { useState, useTransition, type ReactNode } from "react";
import { reorderBanks } from "../actions";

export function BankReorder({
  ids,
  countryId,
  canEdit,
  children,
}: {
  ids: string[];
  countryId: string;
  canEdit: boolean;
  children: ReactNode[];
}) {
  const [order, setOrder] = useState<number[]>(ids.map((_, i) => i));
  const [dragging, setDragging] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function drop(target: number) {
    if (dragging === null || dragging === target) return setDragging(null);
    const next = [...order];
    const from = next.indexOf(dragging);
    const to = next.indexOf(target);
    next.splice(to, 0, ...next.splice(from, 1));
    setOrder(next);
    setDragging(null);
    startTransition(() => {
      reorderBanks(countryId, next.map((i) => ids[i]));
    });
  }

  return (
    <div className={`space-y-3 ${pending ? "opacity-70" : ""}`}>
      {order.map((i) => (
        <div
          key={ids[i]}
          draggable={canEdit}
          onDragStart={() => setDragging(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => drop(i)}
          onDragEnd={() => setDragging(null)}
          className={`flex items-start gap-2 ${dragging === i ? "opacity-40" : ""}`}
        >
          {canEdit && (
            <span
              title="Drag to reorder"
              className="mt-5 cursor-grab select-none px-1 text-lg leading-none text-muted transition-colors hover:text-foreground active:cursor-grabbing"
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
