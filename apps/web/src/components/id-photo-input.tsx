"use client";

// Upload slot for an ID card photo. A phone picture of an ID is usually a small
// card on a big desk, so on selection we find the card's four corners, straighten
// it and crop to it — the operator sees the result and can drag any corner or
// fall back to the untouched photo.

import { useRef, useState } from "react";

const MAX_DIM = 1600;
const QUALITY = 0.85;
/** ID-1 card ratio (85.6 x 54 mm) — what the straightened crop is drawn into. */
export const CARD_RATIO = 85.6 / 54;

type Point = { x: number; y: number };

/** Greyscale + gradient magnitude, downscaled for speed. */
function edgeMap(data: ImageData): { g: Float32Array; w: number; h: number } {
  const { width: w, height: h, data: px } = data;
  const grey = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    grey[i] = (px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114) / 255;
  }
  const g = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = grey[i - 1] - grey[i + 1];
      const gy = grey[i - w] - grey[i + w];
      g[i] = Math.hypot(gx, gy);
    }
  }
  return { g, w, h };
}

/**
 * Find the card by scanning inwards from each side for the first row/column
 * carrying a strong, sustained edge. It is deliberately simple: a wrong guess
 * costs one corner drag, and the operator can always keep the original.
 */
function detectCorners(img: ImageData): Point[] | null {
  const { g, w, h } = edgeMap(img);
  let max = 0;
  for (let i = 0; i < g.length; i++) if (g[i] > max) max = g[i];
  if (max < 0.08) return null;
  const strong = max * 0.35;

  const rowScore = (y: number) => {
    let n = 0;
    for (let x = 0; x < w; x++) if (g[y * w + x] > strong) n++;
    return n / w;
  };
  const colScore = (x: number) => {
    let n = 0;
    for (let y = 0; y < h; y++) if (g[y * w + x] > strong) n++;
    return n / h;
  };

  const HIT = 0.25; // a quarter of the line must be edge to count as a border
  const limitY = Math.floor(h * 0.45);
  const limitX = Math.floor(w * 0.45);
  let top = 0;
  let bottom = h - 1;
  let left = 0;
  let right = w - 1;
  while (top < limitY && rowScore(top) < HIT) top++;
  while (bottom > h - limitY && rowScore(bottom) < HIT) bottom--;
  while (left < limitX && colScore(left) < HIT) left++;
  while (right > w - limitX && colScore(right) < HIT) right--;

  // Nothing found, or the "card" fills the frame already — leave it alone.
  const covers = (right - left) / w > 0.97 && (bottom - top) / h > 0.97;
  if (right - left < w * 0.2 || bottom - top < h * 0.2 || covers) return null;

  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

/** Bilinear sample of the quad mapped onto a card-shaped output canvas. */
function warp(source: HTMLCanvasElement, quad: Point[], scale: number): HTMLCanvasElement {
  const width = Math.round(Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y) * scale);
  const outW = Math.max(600, Math.min(MAX_DIM, width || 900));
  const outH = Math.round(outW / CARD_RATIO);

  const src = source.getContext("2d")!.getImageData(0, 0, source.width, source.height);
  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const dst = out.getContext("2d")!.createImageData(outW, outH);

  const [tl, tr, br, bl] = quad;
  for (let y = 0; y < outH; y++) {
    const v = y / (outH - 1);
    for (let x = 0; x < outW; x++) {
      const u = x / (outW - 1);
      // Bilinear interpolation across the quad's four corners.
      const sx = (1 - v) * ((1 - u) * tl.x + u * tr.x) + v * ((1 - u) * bl.x + u * br.x);
      const sy = (1 - v) * ((1 - u) * tl.y + u * tr.y) + v * ((1 - u) * bl.y + u * br.y);
      const ix = Math.max(0, Math.min(src.width - 1, Math.round(sx)));
      const iy = Math.max(0, Math.min(src.height - 1, Math.round(sy)));
      const s = (iy * src.width + ix) * 4;
      const d = (y * outW + x) * 4;
      dst.data[d] = src.data[s];
      dst.data[d + 1] = src.data[s + 1];
      dst.data[d + 2] = src.data[s + 2];
      dst.data[d + 3] = 255;
    }
  }
  out.getContext("2d")!.putImageData(dst, 0, 0);
  return out;
}

async function toCanvas(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

const toFile = (canvas: HTMLCanvasElement, name: string): Promise<File> =>
  new Promise((resolve) =>
    canvas.toBlob(
      (blob) => resolve(new File([blob!], `${name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" })),
      "image/jpeg",
      QUALITY
    )
  );

export function IdPhotoInput({
  name,
  label,
  existingUrl,
}: {
  name: string;
  label: string;
  /** Signed URL of what is already on file, shown until a new photo is picked. */
  existingUrl?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileNameRef = useRef("id.jpg");
  // The decoded photo drives the corner editor, so it belongs in state.
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [quad, setQuad] = useState<Point[] | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function apply(canvasSource: HTMLCanvasElement, corners: Point[] | null) {
    const canvas = corners ? warp(canvasSource, corners, 1) : canvasSource;
    const file = await toFile(canvas, fileNameRef.current);
    const dt = new DataTransfer();
    dt.items.add(file);
    if (inputRef.current) inputRef.current.files = dt.files;
    setPreview(canvas.toDataURL("image/jpeg", 0.8));
  }

  async function onPick(file: File) {
    setBusy(true);
    setNote("");
    try {
      fileNameRef.current = file.name;
      const canvas = await toCanvas(file);
      setSource(canvas);
      const img = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
      const corners = detectCorners(img);
      setQuad(corners);
      setNote(corners ? "Card edges found — drag a corner if it is off." : "Using the photo as it is.");
      await apply(canvas, corners);
    } catch {
      setNote("Could not read that image.");
    } finally {
      setBusy(false);
    }
  }

  const shown = preview ?? existingUrl ?? null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">{label}</p>

      <label
        title={shown ? `Replace the ${label.toLowerCase()}` : `Upload the ${label.toLowerCase()}`}
        className="block cursor-pointer"
      >
        <input
          ref={inputRef}
          name={name}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (file) void onPick(file);
          }}
        />
        <div
          style={{ aspectRatio: String(CARD_RATIO) }}
          className="flex w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-surface-raised transition-colors hover:border-accent"
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt={label} className="h-full w-full object-contain" />
          ) : (
            <span className="px-4 text-center text-xs text-muted">
              {busy ? "Reading…" : "Click to upload — the card is straightened automatically"}
            </span>
          )}
        </div>
      </label>

      {source && quad && (
        <CornerEditor
          source={source}
          quad={quad}
          onChange={(q) => {
            setQuad(q);
            void apply(source, q);
          }}
          onReset={() => {
            setQuad(null);
            setNote("Using the photo as it is.");
            void apply(source, null);
          }}
        />
      )}
      {note && <p className="text-[11px] text-muted">{note}</p>}
    </div>
  );
}

/** The original photo with four draggable corner handles over it. */
function CornerEditor({
  source,
  quad,
  onChange,
  onReset,
}: {
  source: HTMLCanvasElement;
  quad: Point[];
  onChange: (q: Point[]) => void;
  onReset: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const url = source.toDataURL("image/jpeg", 0.6);

  const move = (e: React.PointerEvent) => {
    if (dragging === null) return;
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const x = ((e.clientX - box.left) / box.width) * source.width;
    const y = ((e.clientY - box.top) / box.height) * source.height;
    onChange(
      quad.map((p, i) =>
        i === dragging
          ? { x: Math.max(0, Math.min(source.width, x)), y: Math.max(0, Math.min(source.height, y)) }
          : p
      )
    );
  };

  return (
    <details className="rounded-lg border border-border">
      <summary className="cursor-pointer px-3 py-1.5 text-[11px] text-muted hover:text-foreground">
        Adjust the detected corners
      </summary>
      <div className="space-y-2 p-3">
        <div
          ref={boxRef}
          onPointerMove={move}
          onPointerUp={() => setDragging(null)}
          onPointerLeave={() => setDragging(null)}
          className="relative w-full touch-none select-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="w-full rounded-md" draggable={false} />
          <svg viewBox={`0 0 ${source.width} ${source.height}`} className="absolute inset-0 h-full w-full">
            <polygon
              points={quad.map((p) => `${p.x},${p.y}`).join(" ")}
              className="fill-[var(--accent)]/15 stroke-[var(--accent)]"
              strokeWidth={source.width / 200}
            />
          </svg>
          {quad.map((p, i) => (
            <button
              key={i}
              type="button"
              title={`Corner ${i + 1}`}
              onPointerDown={() => setDragging(i)}
              style={{ left: `${(p.x / source.width) * 100}%`, top: `${(p.y / source.height) * 100}%` }}
              className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-[var(--accent)] bg-surface active:cursor-grabbing"
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onReset}
          title="Keep the photo exactly as taken"
          className="rounded-md border border-border px-2.5 py-1 text-[11px] text-muted hover:border-accent hover:text-foreground"
        >
          Use the original photo
        </button>
      </div>
    </details>
  );
}
