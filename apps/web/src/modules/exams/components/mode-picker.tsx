"use client";

import { useState } from "react";

export type CategoryOption = { id: string; label: string };

/**
 * How an exam is run: drawn from the question bank and auto-marked, or an AI
 * examiner playing a bank officer who decides pass or fail from a written brief.
 */
export function ExamModePicker({
  mode: initial = "bank",
  categoryId = "",
  aiBrief = "",
  categories,
}: {
  mode?: string;
  categoryId?: string;
  aiBrief?: string;
  categories: CategoryOption[];
}) {
  const [mode, setMode] = useState(initial === "ai_interview" ? "ai_interview" : "bank");

  return (
    <div className="space-y-3 sm:col-span-2">
      <input type="hidden" name="mode" value={mode} />
      <div>
        <label className="mb-1 block text-xs text-muted">Exam Mode</label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("bank")}
            title="Draw questions from the bank and mark them automatically"
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              mode === "bank"
                ? "border-accent bg-accent-soft text-accent-strong"
                : "border-border text-muted hover:border-accent hover:text-foreground"
            }`}
          >
            Draw from question bank
          </button>
          <button
            type="button"
            onClick={() => setMode("ai_interview")}
            title="An AI bank officer interviews the trainee and decides pass or fail"
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              mode === "ai_interview"
                ? "border-accent bg-accent-soft text-accent-strong"
                : "border-border text-muted hover:border-accent hover:text-foreground"
            }`}
          >
            AI interview (pass / fail)
          </button>
        </div>
      </div>

      {mode === "bank" ? (
        <div>
          <label className="mb-1 block text-xs text-muted">Draw from category</label>
          <select name="category_id" defaultValue={categoryId} className="input">
            <option value="">Whole question bank</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-xs text-muted">Interview brief for the AI examiner</label>
          <textarea
            name="ai_brief"
            defaultValue={aiBrief}
            rows={5}
            className="input"
            placeholder={
              "Play a bank officer opening a business account. Ask about the company, the source of funds and the expected monthly turnover. Pass the trainee only if every answer is consistent and confident."
            }
          />
          <p className="mt-1 text-xs text-muted">
            The AI follows this brief, plays the part, and returns a pass or fail with its reasoning — no score.
          </p>
        </div>
      )}
    </div>
  );
}
