"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RetryButton({ seed, level }: { seed: string | null; level: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!seed) return null;

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/replay/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: Number(seed), level }),
      });
      const data = await res.json();
      if (res.ok) router.push(`/replay/${data.sessionId}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" onClick={() => void handleClick()} disabled={loading}>
      {loading ? "준비 중..." : "다시 하기 (같은 시드)"}
    </Button>
  );
}
