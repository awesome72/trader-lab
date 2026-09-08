import type { ReactNode } from "react";

// A collapsed-by-default, plain-language "what is this screen and why does
// it matter" explainer for someone with no investing background — pure
// HTML <details>, no client JS needed, so it costs nothing in bundle size
// and works even if scripts fail to load.
export function PageGuide({ children }: { children: ReactNode }) {
  return (
    <details className="group rounded-md border bg-muted/40 text-sm open:bg-muted/60">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 font-medium marker:hidden">
        이 화면 이해하기
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          <span className="group-open:hidden">펼치기 ▾</span>
          <span className="hidden group-open:inline">접기 ▴</span>
        </span>
      </summary>
      <div className="space-y-2 border-t px-3 py-3 leading-relaxed text-muted-foreground">
        {children}
      </div>
    </details>
  );
}
