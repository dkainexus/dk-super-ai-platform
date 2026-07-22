"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };

const SUGGESTIONS = [
  "How many owners are there, and what status are they in?",
  "Which owners are still pending review?",
  "Summarize my data for me",
];

export function AiChat({ configured, greeting }: { configured: boolean; greeting: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history = [...messages.filter((m) => !m.error), { role: "user" as const, content: question }];
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
      });
      const json = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !json.reply) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: json.error ?? "Something went wrong. Please try again.", error: true },
        ]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: json.reply as string }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Network error — please try again.", error: true },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex h-[calc(100vh-14rem)] min-h-[24rem] flex-col">
      {/* Transcript */}
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-surface-raised px-4 py-3 text-sm">
            <p>{greeting}</p>
            {!configured && (
              <p className="mt-2 text-xs text-danger">
                No API key configured yet — a platform admin must add one under Settings → AI Assistant.
              </p>
            )}
          </div>
        </div>

        {messages.length === 0 && configured && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                title="Ask this question"
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${
                m.role === "user"
                  ? "rounded-tr-sm bg-accent/20 border border-accent/40"
                  : m.error
                    ? "rounded-tl-sm border border-danger/40 bg-danger/10 text-danger"
                    : "rounded-tl-sm border border-border bg-surface-raised"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-sm border border-border bg-surface-raised px-4 py-3 text-sm text-muted">
              <span className="inline-flex items-center gap-1">
                Thinking
                <span className="animate-pulse">…</span>
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t border-border p-4"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder={configured ? "Ask anything about your data…" : "Configure an API key first"}
          disabled={!configured || busy}
          className="input max-h-32 flex-1 resize-none"
        />
        <button
          type="submit"
          disabled={!configured || busy || !input.trim()}
          title="Send your question to the AI Assistant"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity disabled:opacity-40"
        >
          Send
        </button>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setMessages([])}
            title="Clear this conversation"
            className="rounded-md border border-border px-3 py-2 text-sm text-muted hover:border-accent"
          >
            Clear
          </button>
        )}
      </form>
    </div>
  );
}
