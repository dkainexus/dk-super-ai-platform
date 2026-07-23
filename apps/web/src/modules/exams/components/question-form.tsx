"use client";

// Question editor: choice (dynamic options + correct radio) or essay
// (reference answer for the AI grader). Used for both create and edit.

import { useState } from "react";
import { saveQuestion } from "../actions";
import { SaveButton } from "@/components/action-buttons";
import type { ExamQuestion } from "@/lib/types";

type Option = { id: string; label: string };

export function QuestionForm({
  question,
  back,
  merchants,
  countries,
}: {
  question?: ExamQuestion;
  back: string;
  /** Platform side only; merchant users are scoped server-side. */
  merchants?: Option[];
  countries?: Option[];
}) {
  const [type, setType] = useState<"choice" | "essay">(question?.type ?? "choice");
  const [options, setOptions] = useState<string[]>(
    question?.options?.length ? question.options : ["", "", "", ""]
  );
  const [correct, setCorrect] = useState<number>(question?.correct_index ?? 0);

  return (
    <form action={saveQuestion} className="space-y-3">
      {question && <input type="hidden" name="id" value={question.id} />}
      <input type="hidden" name="back" value={back} />
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr_5rem]">
        <div>
          <label className="mb-1 block text-xs text-muted">Type</label>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as "choice" | "essay")}
            className="input"
            disabled={Boolean(question)}
          >
            <option value="choice">Choice</option>
            <option value="essay">Essay (AI)</option>
          </select>
          {question && <input type="hidden" name="type" value={type} />}
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Question</label>
          <input name="question" defaultValue={question?.question ?? ""} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Points</label>
          <input name="points" type="number" min={1} defaultValue={question?.points ?? 1} className="input mono-num" />
        </div>
      </div>

      {!question && merchants && countries && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted">White Label</label>
            <select name="merchant_id" className="input">
              <option value="">All white labels</option>
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Country</label>
            <select name="country_id" className="input">
              <option value="">All countries</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {type === "choice" ? (
        <div className="space-y-2">
          <label className="block text-xs text-muted">Options — tick the correct one</label>
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct_index"
                value={i}
                checked={correct === i}
                onChange={() => setCorrect(i)}
              />
              <input
                name="options"
                value={opt}
                onChange={(e) => setOptions(options.map((o, j) => (j === i ? e.target.value : o)))}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                className="input flex-1"
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    setOptions(options.filter((_, j) => j !== i));
                    if (correct >= i && correct > 0) setCorrect(correct - 1);
                  }}
                  className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-danger"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {options.length < 6 && (
            <button
              type="button"
              onClick={() => setOptions([...options, ""])}
              className="rounded-md border border-border px-3 py-1 text-xs text-muted hover:border-accent hover:text-foreground"
            >
              + Add option
            </button>
          )}
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-xs text-muted">
            Reference answer (the AI examiner grades against this)
          </label>
          <textarea
            name="model_answer"
            rows={3}
            defaultValue={question?.model_answer ?? ""}
            className="input"
            placeholder="Key points a good answer should cover…"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <SaveButton label={question ? "Save" : "Add Question"} tip="Save this question" />
        {question && (
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="hidden" name="active_edit" value="1" />
            <input type="checkbox" name="active" defaultChecked={question.active} value="on" /> Active
          </label>
        )}
      </div>
    </form>
  );
}
