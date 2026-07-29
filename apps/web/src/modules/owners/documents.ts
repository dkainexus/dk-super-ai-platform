import "server-only";
import { zipSync } from "fflate";
import { db } from "@/lib/supabase";
import { DOCS_BUCKET } from "@/lib/storage";
import type { CountryField, Owner, OwnerFieldValue } from "@/lib/types";

export type OwnerDocument = { label: string; path: string };

/**
 * The files attached to an owner that the back office may download: the built-in
 * ID photos always, plus any country upload field ticked as downloadable.
 * `group` narrows it to one part of the profile ("id" = the ID card photos).
 */
export async function ownerDocuments(owner: Owner, group?: "id"): Promise<OwnerDocument[]> {
  const docs: OwnerDocument[] = [];
  const add = (label: string, path: string | null) => {
    if (path) docs.push({ label, path });
  };

  add("ID Front", owner.id_front_path);
  add("ID Back", owner.id_back_path);
  if (group === "id") return docs;
  add("Full-Body Photo", owner.photo_full_body_path);

  const [{ data: fields }, { data: values }] = await Promise.all([
    db()
      .from("country_fields")
      .select("*")
      .eq("country_id", owner.country_id)
      .eq("field_type", "file")
      .eq("downloadable", true),
    db().from("owner_field_values").select("*").eq("owner_id", owner.id),
  ]);
  const byField = new Map(((values ?? []) as OwnerFieldValue[]).map((v) => [v.field_id, v]));
  for (const f of (fields ?? []) as CountryField[]) add(f.label, byField.get(f.id)?.file_path ?? null);

  return docs;
}

const ext = (path: string) => {
  const dot = path.lastIndexOf(".");
  return dot > path.lastIndexOf("/") ? path.slice(dot) : "";
};

const safe = (s: string) => s.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "file";

/** Pack the given documents into a zip, named after the owner. */
export async function zipOwnerDocuments(
  owner: Owner,
  docs: OwnerDocument[]
): Promise<{ bytes: Uint8Array; filename: string }> {
  const files: Record<string, Uint8Array> = {};
  const used = new Set<string>();

  for (const doc of docs) {
    const { data, error } = await db().storage.from(DOCS_BUCKET).download(doc.path);
    if (error || !data) continue;
    let name = `${safe(doc.label)}${ext(doc.path)}`;
    let n = 2;
    while (used.has(name)) name = `${safe(doc.label)} (${n++})${ext(doc.path)}`;
    used.add(name);
    files[name] = new Uint8Array(await data.arrayBuffer());
  }

  const base = safe((owner as { ref?: string | null }).ref || owner.full_name || "owner");
  return { bytes: zipSync(files, { level: 0 }), filename: `${base}.zip` };
}
