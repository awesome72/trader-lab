"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DrillCard, DrillOptionKey } from "@/lib/domain/drills";
import { answerDrill } from "./actions";

export function DrillClient({ cards }: { cards: DrillCard[] }) {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<DrillOptionKey | null>(null);
  const [confidence, setConfidence] = useState(60);
  const [rationale, setRationale] = useState("");
  const [result, setResult] = useState<{ score: number; explanation: string; consistencyScore: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (cards.length === 0) {
    return <p className="text-sm text-muted-foreground">오늘 풀 드릴이 없습니다. 90일 후 다시 확인해주세요.</p>;
  }

  const card = cards[index];

  async function handleSubmit() {
    if (!chosen) return;
    setSubmitting(true);
    setError(null);
    const res = await answerDrill(card.id, chosen, confidence, rationale);
    setSubmitting(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setResult(res);
  }

  function handleNext() {
    setIndex((i) => i + 1);
    setChosen(null);
    setConfidence(60);
    setRationale("");
    setResult(null);
  }

  if (index >= cards.length) {
    return <p className="text-sm text-muted-foreground">오늘 준비된 드릴을 모두 풀었습니다.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {card.title} ({index + 1}/{cards.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 rounded-md border bg-muted p-3 text-sm">
          <p><span className="font-medium">보유상태: </span>{card.situation.holdingState}</p>
          <p><span className="font-medium">가격: </span>{card.situation.priceContext}</p>
          <p><span className="font-medium">시각: </span>{card.situation.timing}</p>
          <p><span className="font-medium">시장상황: </span>{card.situation.marketContext}</p>
        </div>

        {!result ? (
          <>
            <div className="space-y-2">
              {card.options.map((opt) => (
                <label
                  key={opt.key}
                  className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm ${chosen === opt.key ? "border-primary bg-primary/5" : ""}`}
                >
                  <input
                    type="radio"
                    name="option"
                    checked={chosen === opt.key}
                    onChange={() => setChosen(opt.key)}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">{opt.key}. </span>
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm">이 선택에 대한 확신도 (0~100)</label>
              <Input type="number" min={0} max={100} className="w-24" value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm">이유 (선택)</label>
              <Textarea rows={2} value={rationale} onChange={(e) => setRationale(e.target.value)} />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button onClick={() => void handleSubmit()} disabled={!chosen || submitting}>
              {submitting ? "채점 중..." : "제출"}
            </Button>
          </>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border p-3 text-sm">
              <p className="font-semibold">프로세스 정합성 점수: {result.score}/100</p>
              <p className="mt-1 text-muted-foreground">{result.explanation}</p>
              {result.consistencyScore !== null ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  이전 응답 대비 일관성: {result.consistencyScore.toFixed(0)}/100
                </p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">관련 개념: {card.conceptTags.join(", ")}</p>
            </div>
            <Button onClick={handleNext}>다음 카드</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
