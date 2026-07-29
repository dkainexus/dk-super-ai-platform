import { NextRequest } from "next/server";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { ownerDocuments, zipOwnerDocuments } from "@/modules/owners/documents";
import type { Owner } from "@/lib/types";

// One-click download of an owner's documents as a zip. ?group=id gets just the
// two ID card photos.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requirePerm("owners", "view");
  const { id } = await params;
  const group = req.nextUrl.searchParams.get("group") === "id" ? "id" : undefined;

  const { data } = await db().from("owners").select("*").eq("id", id).maybeSingle();
  if (!data) return new Response("Not found", { status: 404 });
  const owner = data as Owner;

  const docs = await ownerDocuments(owner, group);
  if (docs.length === 0) return new Response("This owner has no documents to download", { status: 404 });

  const { bytes, filename } = await zipOwnerDocuments(owner, docs);
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${group === "id" ? filename.replace(/\.zip$/, " - ID.zip") : filename}"`,
    },
  });
}
