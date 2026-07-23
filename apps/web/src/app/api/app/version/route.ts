import { db } from "@/lib/supabase";

// GET /api/app/version → the highest published release. Public (no auth):
// the app checks before login too. The APK link is a 24h signed URL.
export async function GET(): Promise<Response> {
  const { data } = await db()
    .from("app_releases")
    .select("version_code, version_name, notes, apk_path")
    .eq("published", true)
    .order("version_code", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return Response.json({ release: null });

  const { data: signed } = await db()
    .storage.from("app-releases")
    .createSignedUrl(data.apk_path, 60 * 60 * 24, { download: `dk-app-${data.version_name}.apk` });

  return Response.json({
    release: {
      version_code: data.version_code,
      version_name: data.version_name,
      notes: data.notes,
      url: signed?.signedUrl ?? null,
    },
  });
}
