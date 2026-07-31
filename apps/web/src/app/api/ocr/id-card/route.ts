import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser, can } from "@/lib/auth";
import { aiSettings, AI_DEFAULTS } from "@/modules/ai/lib";

// Reads an uploaded ID-card photo and returns the fields as JSON, so the
// owner form can prefill itself. Convenience only — a human always reviews.

/** Thai national ID: the 13th digit is a weighted checksum of the first 12. */
function thaiIdChecksumOk(idNo: string): boolean | null {
  const d = idNo.replace(/\D/g, "");
  if (d.length !== 13) return null;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(d[12]);
}

const PROMPT = `Read this photo of an identity card (likely a Thai national ID card) and return ONLY a JSON object, no prose, no code fences:
{
  "full_name_en": string | null,   // romanised name as printed (e.g. "Mr. Somchai Jaidee" -> "Somchai Jaidee", drop the title)
  "full_name_local": string | null, // name in the local script, drop the title
  "id_number": string | null,      // digits only
  "gender": "male" | "female" | null, // from the title/photo if printed, else null
  "date_of_birth": string | null,  // ISO yyyy-mm-dd, convert Buddhist era to Gregorian if needed
  "address_no": string | null,     // house number portion of the address
  "street": string | null,         // street / moo / soi portion
  "subdistrict": string | null,    // tambon / khwaeng, without the prefix word
  "district": string | null,       // amphoe / khet, without the prefix word
  "province": string | null,       // changwat, without the prefix word
  "postal_code": string | null,
  "address_raw": string | null     // the full address line exactly as printed
}
If a field is unreadable, use null. Do not guess digits.`;

export async function POST(req: Request) {
  const cu = await getCurrentUser();
  if (!cu || (!can(cu, "owners", "add") && !can(cu, "owners", "edit"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const s = await aiSettings();
  if (!s.claude_api_key) {
    return NextResponse.json({ error: "AI is not configured — ask the administrator to add the Claude key." }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No image" }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be under 8MB" }, { status: 400 });
  }
  const mediaType = (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)
    ? file.type
    : "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  try {
    const client = new Anthropic({ apiKey: s.claude_api_key });
    const response = await client.messages.create({
      model: s.claude_model || AI_DEFAULTS.claude_model,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .replace(/```json|```/g, "")
      .trim();
    const parsed = JSON.parse(text) as Record<string, string | null>;
    const idNumber = parsed.id_number ? String(parsed.id_number).replace(/\D/g, "") : null;
    return NextResponse.json({
      ...parsed,
      id_number: idNumber,
      id_checksum_ok: idNumber ? thaiIdChecksumOk(idNumber) : null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Could not read the card: ${e instanceof Error ? e.message : "unknown"}` },
      { status: 502 }
    );
  }
}
