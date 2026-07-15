import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";

// Proxies a Telegram-hosted file through the server so the bot token never
// reaches the browser (Telegram's file URLs embed the token directly).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  await requireUser();
  const { fileId } = await params;
  const token = env.onboardingBotToken();

  const fileInfoRes = await fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`
  );
  const fileInfo = await fileInfoRes.json();
  if (!fileInfo.ok) {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }

  const fileRes = await fetch(
    `https://api.telegram.org/file/bot${token}/${fileInfo.result.file_path}`
  );
  if (!fileRes.ok || !fileRes.body) {
    return NextResponse.json({ error: "failed to fetch file" }, { status: 502 });
  }

  return new NextResponse(fileRes.body, {
    headers: {
      "content-type": fileRes.headers.get("content-type") || "application/octet-stream",
      "cache-control": "private, max-age=3600",
    },
  });
}
