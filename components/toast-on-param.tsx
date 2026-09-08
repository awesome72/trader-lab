"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

export interface ToastParamEntry {
  param: string;
  type: "success" | "error" | "info";
  /** Fixed message, or omit to use the param's own value as the message
   * (for query params like "?error=..." that already carry encoded text). */
  message?: string;
}

// Server Actions in this app confirm success/failure by redirecting with a
// query param (e.g. "?saved=1", "?error=..."), then a page just showed
// static inline text for it. This turns any of those params into a toast
// instead — clearer feedback that something just happened — and strips the
// param from the URL right after so refreshing/going back doesn't re-fire it.
export function ToastOnParam({ entries }: { entries: ToastParamEntry[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    let fired = false;
    const next = new URLSearchParams(searchParams.toString());

    for (const entry of entries) {
      const value = searchParams.get(entry.param);
      if (value === null) continue;
      const message = entry.message ?? value;
      if (entry.type === "success") toast.success(message);
      else if (entry.type === "error") toast.error(message);
      else toast.info(message);
      next.delete(entry.param);
      fired = true;
    }

    if (fired) {
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null;
}
