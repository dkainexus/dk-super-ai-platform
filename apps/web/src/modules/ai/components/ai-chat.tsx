"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };

const SUGGESTIONS = [
  "How many owners are there, and what status are they in?",
  "Which owners are still pending review?",
  "Summarize my data for me",
];

// Shared chat core — used by the full page (/admin/ai, /m/ai) and the
// floating widget. `storageKey` persists the transcript across navigations.
function ChatCore({
  configured,
  greeting,
  storageKey,
  compact = false,
}: {
  configured: boolean;
  greeting: string;
  storageKey?: string;
  compact?: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (storageKey) {
      try {
        const raw = sessionStorage.getItem(storageKey);
        if (raw) setMessages(JSON.parse(raw) as Msg[]);
      } catch {}
    }
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (storageKey && loaded) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(messages));
      } catch {}
    }
  }, [messages, storageKey, loaded]);

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

  const pad = compact ? "p-3" : "p-5";

  return (
    <>
      {/* Transcript */}
      <div className={`flex-1 space-y-3 overflow-y-auto ${pad}`}>
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-surface-raised px-3.5 py-2.5 text-sm">
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
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${
                m.role === "user"
                  ? "rounded-tr-sm border border-accent/40 bg-accent/20"
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
            <div className="rounded-2xl rounded-tl-sm border border-border bg-surface-raised px-3.5 py-2.5 text-sm text-muted">
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
        className={`flex items-end gap-2 border-t border-border ${compact ? "p-3" : "p-4"}`}
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
        {messages.length > 0 && !compact && (
          <button
            type="button"
            onClick={() => setMessages([])}
            title="Clear this conversation"
            className="rounded-md border border-border px-3 py-2 text-sm text-muted hover:border-accent"
          >
            Clear
          </button>
        )}
        {messages.length > 0 && compact && (
          <button
            type="button"
            onClick={() => setMessages([])}
            title="Clear this conversation"
            className="rounded-md border border-border px-2.5 py-2 text-sm text-muted hover:border-accent"
          >
            ✕
          </button>
        )}
      </form>
    </>
  );
}

/** Full-page chat used on /admin/ai and /m/ai. */
export function AiChat({ configured, greeting }: { configured: boolean; greeting: string }) {
  return (
    <div className="card flex h-[calc(100vh-14rem)] min-h-[24rem] flex-col">
      <ChatCore configured={configured} greeting={greeting} storageKey="ai-chat-page" />
    </div>
  );
}

/**
 * Floating AI Assistant — a button fixed to the bottom-right of every page
 * (rendered from the app shell for users whose role can view the AI module).
 * The transcript survives page navigation via sessionStorage.
 */
export function AiWidget({
  configured,
  greeting,
  fullPageHref,
}: {
  configured: boolean;
  greeting: string;
  fullPageHref: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      if (sessionStorage.getItem("ai-widget-open") === "1") setOpen(true);
    } catch {}
  }, []);

  function toggle(next: boolean) {
    setOpen(next);
    try {
      sessionStorage.setItem("ai-widget-open", next ? "1" : "0");
    } catch {}
  }

  // The dedicated page already shows the full chat.
  if (pathname === "/admin/ai" || pathname === "/m/ai") return null;

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-4 z-50 flex h-[min(34rem,calc(100vh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-sm font-semibold">
              <span className="mr-1.5">✦</span>AI Assistant
            </p>
            <div className="flex items-center gap-1">
              <a
                href={fullPageHref}
                title="Open the full-page AI Assistant"
                className="rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-raised hover:text-foreground"
              >
                Full page ↗
              </a>
              <button
                type="button"
                onClick={() => toggle(false)}
                title="Minimize the AI Assistant"
                className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface-raised hover:text-foreground"
              >
                —
              </button>
            </div>
          </div>
          <ChatCore configured={configured} greeting={greeting} storageKey="ai-widget-chat" compact />
        </div>
      )}

      <button
        type="button"
        onClick={() => toggle(!open)}
        title={open ? "Minimize the AI Assistant" : "Ask the AI Assistant about your data"}
        className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-xl text-background shadow-lg shadow-black/40 transition-transform hover:scale-105"
      >
        {open ? "▾" : "✦"}
      </button>
    </>
  );
}
