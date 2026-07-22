import { NextResponse } from "next/server";
import { getCurrentUser, can } from "@/lib/auth";
import { globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import { answerWithAi, type ChatMessage } from "@/modules/ai/lib";

export const maxDuration = 120;

const MAX_TURNS = 30;
const MAX_CHARS = 4000;

export async function POST(req: Request) {
  const cu = await getCurrentUser();
  if (!cu || cu.user.must_change_password) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!can(cu, "ai", "view")) {
    return NextResponse.json({ error: "You do not have access to the AI Assistant." }, { status: 403 });
  }
  const toggles = await globalModuleToggles();
  if (!moduleEnabledFor("ai", toggles, cu.merchant)) {
    return NextResponse.json({ error: "The AI Assistant module is switched off." }, { status: 403 });
  }

  let messages: ChatMessage[];
  try {
    const body = (await req.json()) as { messages?: unknown };
    if (!Array.isArray(body.messages) || body.messages.length === 0) throw new Error("bad");
    messages = body.messages
      .filter(
        (m): m is ChatMessage =>
          !!m &&
          typeof m === "object" &&
          ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
          typeof (m as ChatMessage).content === "string"
      )
      .slice(-MAX_TURNS)
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
    if (messages.length === 0 || messages[messages.length - 1].role !== "user") throw new Error("bad");
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const reply = await answerWithAi(cu, messages);
    return NextResponse.json({ reply });
  } catch (e) {
    const message = e instanceof Error ? e.message : "The AI request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
