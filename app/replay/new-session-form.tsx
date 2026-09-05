"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: "L1 — 캔들만",
  2: "L2 — +이동평균(5, 20)",
  3: "L3 — +거래량",
  4: "L4 — +60분봉 전환 (준비 중)",
  5: "L5 — +투자자 수급 (코스피 오버레이 준비 중)",
};

export function NewSessionForm() {
  const router = useRouter();
  const [market, setMarket] = useState<string>("all");
  const [level, setLevel] = useState("1");
  const [seed, setSeed] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/replay/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market: market === "all" ? undefined : market,
          level: Number(level),
          seed: seed.trim() ? Number(seed) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "세션을 시작할 수 없습니다.");
        return;
      }
      router.push(`/replay/${data.sessionId}`);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>새 리플레이 세션</CardTitle>
        <CardDescription>
          어떤 종목의 언제 구간인지는 세션이 끝날 때까지 공개되지 않습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>시장</Label>
          <Select value={market} onValueChange={(v) => v && setMarket(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="KOSPI">KOSPI</SelectItem>
              <SelectItem value="KOSDAQ">KOSDAQ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>표시 레벨</Label>
          <Select value={level} onValueChange={(v) => v && setLevel(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LEVEL_DESCRIPTIONS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="seed">랜덤 시드 (선택, 같은 시드 = 같은 세션 재현)</Label>
          <Input
            id="seed"
            type="number"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="비워두면 매번 무작위"
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button onClick={handleStart} disabled={loading}>
          {loading ? "시작하는 중..." : "세션 시작"}
        </Button>
      </CardContent>
    </Card>
  );
}
