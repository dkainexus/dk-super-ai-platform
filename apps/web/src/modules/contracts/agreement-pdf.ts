import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { fmtNum } from "@/lib/format";

// One agreement, one PDF: the account, the conditions, the confirmation
// record, and the full T&C text of exactly the version that was accepted.

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 56;

const hasThai = (s: string) => /[฀-๿]/.test(s);

export type AgreementPdfInput = {
  ref: string;
  customerName: string;
  bankName: string;
  accountNo: string;
  assignedOn: string;
  confirmedAt: string | null;
  status: string;
  liveOn: string | null;
  delivery: string;
  conditions: {
    mode?: string;
    rent?: number;
    turnover_pct?: number | null;
    setup_fee?: number;
    deposit?: number;
    contract_months?: number | null;
    renewal_months?: number | null;
  };
  tncTitle: string;
  tncVersion: number | null;
  tncBody: string;
};

const MODE_TEXT: Record<string, string> = {
  rent: "Fixed monthly price",
  turnover: "Share of turnover only",
  rent_plus_turnover: "Monthly price plus a share of turnover",
  max: "Monthly price, or the turnover share when higher",
};

export async function buildAgreementPdf(input: AgreementPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const fontsDir = path.join(process.cwd(), "src/assets/fonts");
  const latin = await doc.embedFont(await readFile(path.join(fontsDir, "NotoSans.ttf")), { subset: true });
  const thai = await doc.embedFont(await readFile(path.join(fontsDir, "NotoSansThai.ttf")), { subset: true });
  const pick = (s: string): PDFFont => (hasThai(s) ? thai : latin);

  let page: PDFPage = doc.addPage([A4.w, A4.h]);
  let y = A4.h - MARGIN;
  const width = A4.w - MARGIN * 2;

  const newPageIfNeeded = (need: number) => {
    if (y - need < MARGIN) {
      page = doc.addPage([A4.w, A4.h]);
      y = A4.h - MARGIN;
    }
  };

  const write = (text: string, size: number, opts?: { gap?: number; color?: [number, number, number] }) => {
    // Wrap on the font's real measurements, line by line.
    for (const paragraph of text.split("\n")) {
      const font = pick(paragraph);
      const words = paragraph.split(" ");
      let line = "";
      const flush = () => {
        if (line === "") return;
        newPageIfNeeded(size + 4);
        page.drawText(line, {
          x: MARGIN,
          y,
          size,
          font,
          color: opts?.color ? rgb(...opts.color) : rgb(0.1, 0.1, 0.12),
        });
        y -= size + 4;
        line = "";
      };
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        let fits = true;
        try {
          fits = font.widthOfTextAtSize(candidate, size) <= width;
        } catch {
          // A glyph neither font covers — drop it rather than die.
          continue;
        }
        if (!fits) flush();
        line = line ? `${line} ${word}` : word;
      }
      flush();
      if (paragraph === "") y -= size;
    }
    y -= opts?.gap ?? 4;
  };

  write("Rental Agreement", 20, { gap: 2 });
  write(`${input.ref} — generated as a record of what was accepted`, 9, { gap: 12, color: [0.4, 0.42, 0.45] });

  write("Account", 12, { gap: 2 });
  write(`${input.bankName} · ${input.accountNo}`, 11);
  write(`Customer: ${input.customerName}`, 11);
  write(`Assigned: ${input.assignedOn}   Delivery: ${input.delivery === "shipping" ? "shipping" : "direct binding"}`, 10);
  write(
    input.confirmedAt
      ? `Confirmed by the customer: ${input.confirmedAt}`
      : "Not yet confirmed by the customer",
    10,
    { gap: 12 }
  );

  const c = input.conditions;
  write("Conditions", 12, { gap: 2 });
  write(`Pricing: ${MODE_TEXT[c.mode ?? "max"]}`, 10);
  if (c.mode !== "turnover") write(`Monthly price: ${fmtNum(c.rent ?? 0)}`, 10);
  if (c.turnover_pct != null) write(`Turnover share: ${c.turnover_pct}%`, 10);
  write(`Setup fee (once): ${fmtNum(c.setup_fee ?? 0)}`, 10);
  write(`Insurance (written, not collected): ${fmtNum(c.deposit ?? 0)}`, 10);
  write(`Minimum term: ${c.contract_months ?? "—"} months   Renewal: ${c.renewal_months ?? "—"} months`, 10, { gap: 12 });
  if (input.liveOn) write(`Billing since: ${input.liveOn}`, 10, { gap: 12 });

  write(`${input.tncTitle}${input.tncVersion != null ? ` — version ${input.tncVersion}` : ""}`, 12, { gap: 4 });
  write(input.tncBody, 9, { gap: 0 });

  return doc.save();
}
