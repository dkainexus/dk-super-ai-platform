"use client";

// Every question in a set on one form: numbered 1, 2, 3…, add as many as you
// like, then save the lot in one go. Choice questions mark their correct option;
// essay questions carry a reference answer for the AI grader.

import { useState } from "react";
import { saveQuestionSet } from "../actions";
import { ActionButton, SaveButton } from "@/components/action-buttons";
import type { ExamQuestion } from "@/lib/types";

type Draft = {
  /** Empty for a question that has not been saved yet. */
  id: string;
  type: "choice" | "essay";
  question: string;
  options: string[];
  correct: number;
  modelAnswer: string;
  points: number;
  active: boolean;
};

const blank = (): Draft => ({
  id: "",
  type: "choice",
  question: "",
  options: ["", "", "", ""],
  correct: 0,
  modelAnswer: "",
  points: 1,
  active: true,
});

const fromRow = (q: ExamQuestion): Draft => ({
  id: q.id,
  type: q.type === "essay" ? "essay" : "choice",
  question: q.question,
  options: q.options?.length ? [...q.options] : ["", "", "", ""],
  correct: q.correct_index ?? 0,
  modelAnswer: q.model_answer ?? "",
  points: q.points,
  active: q.active,
});

export function QuestionSetEditor({
  questions,
  categoryId,
  back,
  canEdit,
  canDelete,
  merchantId,
}: {
  questions: ExamQuestion[];
  /** The set these belong to; empty for the loose questions. */
  categoryId: string;
  back: string;
  canEdit: boolean;
  canDelete: boolean;
  /** Platform side: the white label new questions are filed under. */
  merchantId?: string;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    questions.length ? questions.map(fromRow) : [blank()]
  );
  const [removed, setRemoved] = useState<string[]>([]);

  const patch = (i: number, change: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d, j) => (j === i ? { ...d, ...change } : d)));

  const remove = (i: number) => {
    const d = drafts[i];
    if (d.id) setRemoved((prev) => [...prev, d.id]);
    setDrafts((prev) => prev.filter((_, j) => j !== i));
  };

  if (!canEdit) {
    return (
      <div className="space-y-3">
        {drafts.map((d, i) => (
          <div key={i} className="card p-4">
            <p className="text-sm font-medium">
              <span className="mono-num mr-2 text-muted">{i + 1}.</span>
              {d.question}
            </p>
            {d.type === "choice" ? (
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {d.options.filter(Boolean).map((o, k) => (
                  <li key={k} className={k === d.correct ? "text-success" : undefined}>
                    {String.fromCharCode(65 + k)}. {o} {k === d.correct && "✓"}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">Reference: {d.modelAnswer || "—"}</p>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <form action={saveQuestionSet} className="space-y-4">
      <input type="hidden" name="category_id" value={categoryId} />
      <input type="hidden" name="back" value={back} />
      {merchantId !== undefined && <input type="hidden" name="merchant_id" value={merchantId} />}
      {removed.map((id) => (
        <input key={id} type="hidden" name="removed" value={id} />
      ))}

      {drafts.map((d, i) => (
        <div key={i} className="card space-y-3 p-4">
          <input type="hidden" name={`q_${i}_id`} value={d.id} />

          <div className="flex items-start gap-3">
            <span className="mono-num pt-2 text-sm font-semibold text-muted">{i + 1}.</span>
            <div className="flex-1">
              <textarea
                name={`q_${i}_question`}
                value={d.question}
                onChange={(e) => patch(i, { question: e.target.value })}
                rows={2}
                placeholder="Type the question"
                className="input"
              />
            </div>
            <ActionButton
              icon="trash"
              tip={d.id ? "Delete this question when you save" : "Remove this row"}
              variant="danger"
              type="button"
              onClick={() => remove(i)}
            />
          </div>

          <div className="grid gap-3 pl-7 sm:grid-cols-[9rem_5rem_auto]">
            <div>
              <label className="mb-1 block text-xs text-muted">Type</label>
              <select
                name={`q_${i}_type`}
                value={d.type}
                onChange={(e) => patch(i, { type: e.target.value as "choice" | "essay" })}
                className="input"
              >
                <option value="choice">Choice</option>
                <option value="essay">Essay (AI)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Points</label>
              <input
                name={`q_${i}_points`}
                type="number"
                min={1}
                value={d.points}
                onChange={(e) => patch(i, { points: parseInt(e.target.value, 10) || 1 })}
                className="input mono-num"
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-xs text-muted sm:self-end">
              <input
                type="checkbox"
                name={`q_${i}_active`}
                checked={d.active}
                onChange={(e) => patch(i, { active: e.target.checked })}
              />
              Active
            </label>
          </div>

          {d.type === "choice" ? (
            <div className="space-y-2 pl-7">
              <p className="text-xs text-muted">Options — tick the correct one</p>
              {d.options.map((o, k) => (
                <div key={k} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`q_${i}_correct`}
                    value={k}
                    checked={d.correct === k}
                    onChange={() => patch(i, { correct: k })}
                    title="This is the correct answer"
                  />
                  <span className="mono-num w-4 text-xs text-muted">{String.fromCharCode(65 + k)}</span>
                  <input
                    name={`q_${i}_options`}
                    value={o}
                    onChange={(e) =>
                      patch(i, { options: d.options.map((x, j) => (j === k ? e.target.value : x)) })
                    }
                    className="input flex-1"
                    placeholder={`Option ${String.fromCharCode(65 + k)}`}
                  />
                  {d.options.length > 2 && (
                    <button
                      type="button"
                      title="Remove this option"
                      onClick={() =>
                        patch(i, {
                          options: d.options.filter((_, j) => j !== k),
                          correct: d.correct > k ? d.correct - 1 : Math.min(d.correct, d.options.length - 2),
                        })
                      }
                      className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:border-danger hover:text-danger"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {d.options.length < 6 && (
                <button
                  type="button"
                  onClick={() => patch(i, { options: [...d.options, ""] })}
                  className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-foreground"
                >
                  + Option
                </button>
              )}
            </div>
          ) : (
            <div className="pl-7">
              <label className="mb-1 block text-xs text-muted">Reference answer (what a good answer covers)</label>
              <textarea
                name={`q_${i}_model_answer`}
                value={d.modelAnswer}
                onChange={(e) => patch(i, { modelAnswer: e.target.value })}
                rows={2}
                className="input"
              />
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setDrafts((prev) => [...prev, blank()])}
          title="Add another question to this set"
          className="rounded-md border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent hover:text-foreground"
        >
          + Add Question
        </button>
        <SaveButton label={`Save ${drafts.length} Question${drafts.length === 1 ? "" : "s"}`} tip="Save the whole set" />
        {removed.length > 0 && canDelete && (
          <span className="text-xs text-danger">
            {removed.length} question{removed.length === 1 ? "" : "s"} will be deleted on save
          </span>
        )}
      </div>
    </form>
  );
}
