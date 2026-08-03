// The instant answer to every tap: a pulsing sketch of the page that shows
// while the real one loads. Route-level loading.tsx files render this.
export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="space-y-2">
        <div className="h-6 w-48 rounded-lg bg-surface-raised" />
        <div className="h-3.5 w-80 max-w-full rounded bg-surface-raised/70" />
      </div>
      <div className="flex items-end justify-between">
        <div className="h-4 w-24 rounded bg-surface-raised/70" />
        <div className="h-9 w-56 max-w-[40%] rounded-lg bg-surface-raised/60" />
      </div>
      <div className="card overflow-hidden p-0">
        <div className="h-10 border-b border-border bg-surface-raised/40" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0">
            <div className="h-3.5 w-24 rounded bg-surface-raised/70" />
            <div className="h-3.5 w-40 rounded bg-surface-raised/60" />
            <div className="h-3.5 w-28 rounded bg-surface-raised/50" />
            <div className="ml-auto h-6 w-16 rounded-full bg-surface-raised/60" />
          </div>
        ))}
      </div>
    </div>
  );
}
