// Generic skeleton shown by Next.js while any route segment loads (nested
// loading UI — applies app-wide via bubbling). Mirrors the rough shape most
// pages share (title, filter row, a grid of stat cards, one chart block)
// so the page doesn't flash to a totally blank/centered-spinner state —
// less jarring, and gives a sense of what's about to appear.
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="h-7 w-56 animate-pulse rounded-md bg-muted" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-6 w-14 animate-pulse rounded-full bg-muted" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-md bg-muted" />
    </div>
  );
}
