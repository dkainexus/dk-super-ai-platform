import { requirePerm } from "@/lib/auth";
import { placeAutocomplete, placeDetails } from "@/lib/places";

// Staff-side Places proxy (session-authenticated) used by the branch picker.
// GET  ?q=...&region=TH  → suggestions
// GET  ?place_id=...     → standardised details

export async function GET(req: Request): Promise<Response> {
  await requirePerm("banks", "view");
  const url = new URL(req.url);
  const placeId = url.searchParams.get("place_id");

  try {
    if (placeId) return Response.json(await placeDetails(placeId));
    const q = url.searchParams.get("q") ?? "";
    const region = url.searchParams.get("region");
    return Response.json({ suggestions: await placeAutocomplete(q, region) });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Places lookup failed" },
      { status: 502 }
    );
  }
}
