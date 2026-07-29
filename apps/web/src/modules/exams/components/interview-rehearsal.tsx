"use client";

// Sit the interview yourself before publishing it. It runs the same examiner the
// trainees get, against whatever is currently typed in the Reference box, and
// records nothing.

import { useRef, useState } from "react";
import { rehearseInterview } from "../actions";

/** Mirrors InterviewMessage — the lib it lives in is server-only. */
type Line = { role: "assistant" | "user"; content: string };

export function InterviewRehearsal({ examId }: { examId: string }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<{ passed: boolean; reason: string } | null>(null);
  const [error, setError] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  /** Read the Reference box as it is right now, saved or not. */
  const reference = () => {
    const el = document.querySelector<HTMLTextAreaElement>('textarea[name="ai_brief"]');
    return el?.value ?? "";
  };

  const scroll = () =>
    requestAnimationFrame(() => {
      if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
    });

  async function send(history: Line[]) {
    setBusy(true);
    setError("");
    const result = await rehearseInterview(examId, reference(), history);
    setBusy(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }
    const next = result.reply ? [...history, { role: "assistant" as const, content: result.reply }] : history;
    setLines(next);
    if (result.done) setVerdict({ passed: result.passed === true, reason: result.reason });
    scroll();
  }

  function start() {
    setOpen(true);
    setLines([]);
    setVerdict(null);
    setAnswer("");
    void send([]);
  }

  function reply() {
    const text = answer.trim();
    if (!text || busy || verdict) return;
    const next: Line[] = [...lines, { role: "user", content: text }];
    setLines(next);
    setAnswer("");
    scroll();
    void send(next);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={start}
        title="Sit this interview yourself — nothing is recorded"
        className="rounded-md border border-accent/40 bg-accent-soft px-3 py-1.5 text-sm text-accent-strong transition-colors hover:border-accent"
      >
        ▶ Try it
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-accent/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Rehearsal — nothing here is recorded</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={start}
            disabled={busy}
            title="Start the conversation again with the Reference as it is now"
            className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-foreground disabled:opacity-60"
          >
            Restart
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            title="Close the rehearsal"
            className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-foreground"
          >
            Close
          </button>
        </div>
      </div>

      <div ref={boxRef} className="max-h-80 space-y-2 overflow-y-auto rounded-lg bg-surface-raised p-3">
        {lines.length === 0 && !busy && <p className="text-xs text-muted">Starting…</p>}
        {lines.map((l, i) => (
          <div key={i} className={l.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <p
              className={`max-w-[80%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                l.role === "user"
                  ? "bg-accent text-background"
                  : "border border-border bg-surface text-foreground"
              }`}
            >
              {l.content}
            </p>
          </div>
        ))}
        {busy && <p className="text-xs text-muted">The examiner is thinking…</p>}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      {verdict ? (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-lg border px-3 py-2.5 text-sm ${
            verdict.passed
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          }`}
        >
          <p className="font-medium">{verdict.passed ? "Passed" : "Failed"}</p>
          {verdict.reason && <p className="mt-0.5 text-xs opacity-90">{verdict.reason}</p>}
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                reply();
              }
            }}
            rows={2}
            placeholder="Answer as a trainee would…"
            className="input flex-1"
            disabled={busy}
          />
          <button
            type="button"
            onClick={reply}
            disabled={busy || !answer.trim()}
            title="Send this answer"
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-background hover:bg-accent-strong disabled:opacity-60"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
