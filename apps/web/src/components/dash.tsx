import Link from "next/link";

// Crypto-styled dashboard building blocks: coin-style icon medallions, big
// gradient numbers and inline SVG sparklines (no chart library).

export type Palette = { from: string; to: string };
export const PALETTES = {
  cyan: { from: "#22d3ee", to: "#6366f1" },
  violet: { from: "#a78bfa", to: "#6366f1" },
  blue: { from: "#60a5fa", to: "#818cf8" },
  green: { from: "#34d399", to: "#10b981" },
  amber: { from: "#fbbf24", to: "#f59e0b" },
  pink: { from: "#f472b6", to: "#a78bfa" },
  red: { from: "#f87171", to: "#ef4444" },
} satisfies Record<string, Palette>;

let gradientSeq = 0;

/** Smooth area sparkline. Pass daily counts; it normalizes itself. */
export function Sparkline({
  values,
  palette,
  width = 220,
  height = 56,
}: {
  values: number[];
  palette: Palette;
  width?: number;
  height?: number;
}) {
  const id = `spark-${gradientSeq++}`;
  const max = Math.max(...values, 1);
  const stepX = width / Math.max(values.length - 1, 1);
  const pad = 4;
  const pts = values.map((v, i) => [i * stepX, height - pad - (v / max) * (height - pad * 2)]);
  // Catmull-Rom-ish smoothing via midpoint quadratics
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2;
    d += ` Q ${x0},${y0} ${mx},${(y0 + y1) / 2}`;
    if (i === pts.length - 1) d += ` T ${x1},${y1}`;
  }
  const area = `${d} L ${width},${height} L 0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.from} stopOpacity="0.35" />
          <stop offset="100%" stopColor={palette.to} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={palette.from} />
          <stop offset="100%" stopColor={palette.to} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id}-fill)`} />
      <path d={d} fill="none" stroke={`url(#${id}-stroke)`} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Tiny bar chart (WOOFi-style earnings bars). */
export function BarSpark({ values, palette, width = 120, height = 40 }: { values: number[]; palette: Palette; width?: number; height?: number }) {
  const id = `bars-${gradientSeq++}`;
  const max = Math.max(...values, 1);
  const gap = 2;
  const bw = (width - gap * (values.length - 1)) / values.length;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.from} />
          <stop offset="100%" stopColor={palette.to} stopOpacity="0.4" />
        </linearGradient>
      </defs>
      {values.map((v, i) => {
        const h = Math.max((v / max) * height, v > 0 ? 3 : 1.5);
        return <rect key={i} x={i * (bw + gap)} y={height - h} width={bw} height={h} rx="1.5" fill={`url(#${id})`} opacity={v > 0 ? 1 : 0.25} />;
      })}
    </svg>
  );
}

/** Coin-style icon medallion. */
export function Coin({ icon, palette }: { icon: string; palette: Palette }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base shadow-lg"
      style={{
        background: `linear-gradient(135deg, ${palette.from}, ${palette.to})`,
        boxShadow: `0 0 18px ${palette.from}44`,
      }}
    >
      {icon}
    </span>
  );
}

export function GradientNumber({ value, palette, className = "text-3xl" }: { value: string | number; palette: Palette; className?: string }) {
  return (
    <span
      className={`mono-num font-semibold ${className}`}
      style={{
        background: `linear-gradient(90deg, ${palette.from}, ${palette.to})`,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      }}
    >
      {value}
    </span>
  );
}

/** Compact stat card: coin icon + label + gradient number + mini chart. */
export function StatCard({
  label,
  value,
  icon,
  palette,
  href,
  spark,
  bars,
  sub,
}: {
  label: string;
  value: string | number;
  icon: string;
  palette: Palette;
  href: string;
  spark?: number[];
  bars?: number[];
  sub?: string;
}) {
  return (
    <Link
      href={href}
      className="card group relative block overflow-hidden p-4 transition-all hover:-translate-y-0.5"
      style={{ boxShadow: `inset 0 1px 0 #ffffff0a` }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: `radial-gradient(120% 90% at 50% 0%, ${palette.from}14, transparent 60%)` }}
      />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <Coin icon={icon} palette={palette} />
            <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
          </div>
          <p className="mt-2.5">
            <GradientNumber value={value} palette={palette} />
          </p>
          {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
        </div>
        {(spark || bars) && (
          <div className="h-12 w-24 shrink-0 self-end opacity-80">
            {spark ? <Sparkline values={spark} palette={palette} width={96} height={48} /> : <BarSpark values={bars!} palette={palette} width={96} height={48} />}
          </div>
        )}
      </div>
    </Link>
  );
}

/** Hero card: the big "Total Value Locked"-style number with a full-width chart. */
export function HeroCard({
  label,
  value,
  sub,
  palette,
  spark,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  palette: Palette;
  spark: number[];
  href: string;
}) {
  return (
    <Link href={href} className="card group relative block overflow-hidden p-5 transition-all hover:-translate-y-0.5 sm:p-6">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(140% 100% at 85% 0%, ${palette.from}12, transparent 55%)` }}
      />
      <div className="relative">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
        <p className="mt-2">
          <GradientNumber value={value} palette={palette} className="text-5xl" />
        </p>
        {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
      </div>
      <div className="relative mt-4 h-20">
        <Sparkline values={spark} palette={palette} width={560} height={80} />
      </div>
    </Link>
  );
}

/** Bucket ISO timestamps into daily counts for the last `days` days. */
export function dailyCounts(timestamps: (string | null)[], days = 14): number[] {
  const out = new Array(days).fill(0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const t of timestamps) {
    if (!t) continue;
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
    if (diff >= 0 && diff < days) out[days - 1 - diff]++;
  }
  return out;
}

/** Cumulative version — nicer hero curves for "total so far". */
export function cumulative(values: number[], baseline = 0): number[] {
  let acc = baseline;
  return values.map((v) => (acc += v));
}
