"use client";

import { useState } from "react";
import { InterviewRehearsal } from "./interview-rehearsal";

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
  children,
  examId,
}: {
  mode?: string;
  categoryId?: string;
  aiBrief?: string;
  categories: CategoryOption[];
  /** Settings that only apply to a marked exam — hidden for the interview. */
  children?: React.ReactNode;
  /** Set once the exam exists, which is when it can be rehearsed. */
  examId?: string;
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
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem] sm:items-end">
          <div>
            <label className="mb-1 block text-xs text-muted">Question set</label>
            <select name="category_id" defaultValue={categoryId} className="input" required>
              <option value="">— Select a set —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted">
              The exam asks every question in the set. Manage sets under Exams → Question Categories.
            </p>
          </div>
          {children}
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-xs text-muted">Reference</label>
          <p className="mb-1.5 text-xs text-muted">
            Tell the examiner three things: <b>who it is</b>, <b>what it must find out</b>, and{" "}
            <b>what counts as a pass</b>.
          </p>
          <textarea
            name="ai_brief"
            defaultValue={aiBrief}
            rows={7}
            className="input"
            placeholder={
              "You are a teller at a Thai bank doing due diligence on someone opening a company account.\n\n" +
              "Find out what the company actually does, where its money comes from, and the monthly turnover " +
              "they expect.\n\n" +
              "Fail them if their answers contradict each other, if they cannot explain the source of funds, " +
              "or if they are clearly reciting a script."
            }
          />
          <p className="mt-1 text-xs text-muted">
            There are no questions to write — the examiner decides what to ask, how long to keep going, and whether
            the trainee passed. It answers in whatever language the trainee uses.
          </p>
          {examId && (
            <div className="mt-3">
              <InterviewRehearsal examId={examId} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
