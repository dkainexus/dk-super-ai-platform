import "server-only";

// Google Places API (New) — server-side only. The key never reaches the
// browser or the app; both call our own endpoints, which proxy to Google.

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_URL = "https://places.googleapis.com/v1/places";

export type PlaceSuggestion = { place_id: string; name: string; address: string };
export type PlaceDetails = {
  place_id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
};

function apiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("Google Places is not configured");
  return key;
}

/** Branch search: suggestions biased to one country (ISO-3166 alpha-2). */
export async function placeAutocomplete(input: string, regionCode?: string | null): Promise<PlaceSuggestion[]> {
  if (input.trim().length < 2) return [];
  const res = await fetch(AUTOCOMPLETE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey() },
    body: JSON.stringify({
      input,
      // Branches, not ATMs (a few ATMs are still typed as banks — filtered below)
      includedPrimaryTypes: ["bank"],
      ...(regionCode ? { includedRegionCodes: [regionCode.toLowerCase()] } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Places search failed (${res.status})`);
  const json = (await res.json()) as {
    suggestions?: {
      placePrediction?: {
        placeId?: string;
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
        text?: { text?: string };
      };
    }[];
  };
  return (json.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
    .map((p) => ({
      place_id: p.placeId!,
      name: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      address: p.structuredFormat?.secondaryText?.text ?? p.text?.text ?? "",
    }))
    .filter((p) => !/\bATM\b|ตู้เอทีเอ็ม/i.test(p.name));
}

/** Standardised name + full address + coordinates for a chosen place. */
export async function placeDetails(placeId: string): Promise<PlaceDetails> {
  const res = await fetch(`${DETAILS_URL}/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
    },
  });
  if (!res.ok) throw new Error(`Place lookup failed (${res.status})`);
  const json = (await res.json()) as {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
  };
  return {
    place_id: json.id ?? placeId,
    name: json.displayName?.text ?? "",
    address: json.formattedAddress ?? "",
    lat: json.location?.latitude ?? null,
    lng: json.location?.longitude ?? null,
  };
}
