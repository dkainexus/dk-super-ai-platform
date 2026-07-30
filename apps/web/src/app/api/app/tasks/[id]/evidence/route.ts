import { ownerFromRequest, unauthorized } from "@/lib/app-auth";
import { db } from "@/lib/supabase";
import { uploadFile, fileExt, DOCS_BUCKET } from "@/lib/storage";

// POST /api/app/tasks/:id/evidence (multipart: note?, file?) — the owner's
// proof that they acted: a recording, a document, a photo.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const owner = await ownerFromRequest(req);
  if (!owner) return unauthorized();
  const { id } = await params;

  const { data: t } = await db()
    .from("tickets")
    .select("id, status, bank_account:bank_accounts!inner(owner_id)")
    .eq("id", id)
    .maybeSingle();
  const accountOwner = (t?.bank_account as unknown as { owner_id: string | null } | null)?.owner_id;
  if (!t || accountOwner !== owner.id) return Response.json({ error: "Not found" }, { status: 404 });
  if (t.status === "handled" || t.status === "resolved")
    return Response.json({ error: "This task is closed" }, { status: 400 });

  const form = await req.formData();
  const note = String(form.get("note") ?? "").trim();
  const file = form.get("file");
  let path: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > 20 * 1024 * 1024) return Response.json({ error: "File too large (max 20MB)" }, { status: 400 });
    path = await uploadFile(DOCS_BUCKET, `tickets/${id}/${Date.now()}.${fileExt(file)}`, file);
  }
  if (!note && !path) return Response.json({ error: "Send a note or a file" }, { status: 400 });

  await db().from("ticket_messages").insert({
    ticket_id: id,
    author_type: "owner",
    author_id: owner.id,
    body: note || null,
    attachment_path: path,
  });
  return Response.json({ ok: true });
}
