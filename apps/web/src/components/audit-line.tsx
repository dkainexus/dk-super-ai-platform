import { db } from "@/lib/supabase";

type Props = {
  createdBy?: string | null;
  createdAt?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
};

async function names(ids: string[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter(Boolean))];
  if (wanted.length === 0) return new Map();
  const { data } = await db().from("users").select("id, name, username").in("id", wanted);
  return new Map(
    ((data ?? []) as { id: string; name: string | null; username: string }[]).map((u) => [
      u.id,
      u.name || u.username,
    ])
  );
}

const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : null;

// "Entered by X on … · Last edited by Y on …" — shown at the bottom of detail pages.
export async function AuditLine({ createdBy, createdAt, updatedBy, updatedAt }: Props) {
  const map = await names([createdBy ?? "", updatedBy ?? ""]);
  const parts: string[] = [];
  if (createdAt) parts.push(`Entered by ${map.get(createdBy ?? "") ?? "system"} on ${when(createdAt)}`);
  if (updatedAt && updatedAt !== createdAt)
    parts.push(`Last edited by ${map.get(updatedBy ?? "") ?? "system"} on ${when(updatedAt)}`);
  if (parts.length === 0) return null;

  return <p className="text-xs text-muted">{parts.join(" · ")}</p>;
}
