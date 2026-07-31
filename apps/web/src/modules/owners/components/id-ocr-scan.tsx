"use client";

import { useState } from "react";

type OcrResult = {
  full_name_en?: string | null;
  full_name_local?: string | null;
  id_number?: string | null;
  gender?: string | null;
  address_no?: string | null;
  street?: string | null;
  subdistrict?: string | null;
  district?: string | null;
  province?: string | null;
  postal_code?: string | null;
  address_raw?: string | null;
  id_checksum_ok?: boolean | null;
  error?: string;
};

/** Fill an uncontrolled form field by name, if the OCR read something. */
function setField(name: string, value: string | null | undefined) {
  if (!value) return;
  const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
  if (!el || el.type === "hidden") return;
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

// Convenience, not authority: pick the ID photo, the readable fields land in
// the form, the human corrects and saves. Region dropdowns stay manual — the
// card's own address line is shown for copying.
export function IdOcrScan() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);

  async function scan(file: File) {
    setBusy(true);
    setNote(null);
    try {
      const body = new FormData();
      body.append("image", file);
      const res = await fetch("/api/ocr/id-card", { method: "POST", body });
      const j = (await res.json()) as OcrResult;
      if (!res.ok || j.error) {
        setNote({ kind: "err", text: j.error ?? "Could not read the card" });
        return;
      }
      setField("full_name", j.full_name_en ?? j.full_name_local);
      setField("id_number", j.id_number);
      if (j.gender === "male" || j.gender === "female") setField("gender", j.gender);
      setField("address_no", j.address_no);
      setField("street", j.street);
      setField("postal_code", j.postal_code);

      const regionBits = [j.subdistrict, j.district, j.province].filter(Boolean).join(" · ");
      if (j.id_checksum_ok === false) {
        setNote({
          kind: "warn",
          text: `Filled — but the ID number failed its checksum, please compare it with the card.${regionBits ? ` Card address: ${regionBits}` : ""}`,
        });
      } else {
        setNote({
          kind: "ok",
          text: `Filled from the card — please check every field.${regionBits ? ` Pick the region below: ${regionBits}` : ""}`,
        });
      }
    } catch {
      setNote({ kind: "err", text: "Could not read the card" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <label
          className={`cursor-pointer rounded-lg border border-accent/50 px-3 py-1.5 text-sm text-accent-strong transition-colors hover:bg-accent-soft ${busy ? "pointer-events-none opacity-50" : ""}`}
        >
          {busy ? "Reading the card…" : "📷 Scan ID → auto-fill"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void scan(f);
              e.target.value = "";
            }}
          />
        </label>
        <p className="text-xs text-muted">Pick a clear photo of the ID front — the fields below fill themselves.</p>
      </div>
      {note && (
        <p
          className={`mt-2 text-xs ${
            note.kind === "ok" ? "text-success" : note.kind === "warn" ? "text-warning" : "text-danger"
          }`}
        >
          {note.text}
        </p>
      )}
    </div>
  );
}
