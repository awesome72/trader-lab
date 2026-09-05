"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { QuizChart } from "./quiz-chart";

interface QuizBar {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  idx: number;
}
interface QuizQuestion {
  recordId: string;
  bars: QuizBar[];
}
interface GradeResult {
  recordId: string;
  predictedProb: number;
  outcome: boolean;
  squaredError: number;
}
interface SubmitResponse {
  results: GradeResult[];
  brierScore: number | null;
  coinFlipBrierScore: number;
}

export function QuizClient() {
  const [phase, setPhase] = useState<"idle" | "loading" | "running" | "grading" | "done">("idle");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPhase("loading");
    setError(null);
    try {
      const res = await fetch("/api/calibration/quiz/start", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "퀴즈를 시작할 수 없습니다.");
        setPhase("idle");
        return;
      }
      setQuestions(data.questions);
      setCurrent(0);
      setAnswers({});
      setPhase("running");
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setPhase("idle");
    }
  }

  async function submit() {
    setPhase("grading");
    const payload = {
      answers: questions.map((q) => ({ recordId: q.recordId, predictedProb: (answers[q.recordId] ?? 50) / 100 })),
    };
    const res = await fetch("/api/calibration/quiz/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setResult(data);
    setPhase("done");
  }

  if (phase === "idle" || phase === "loading") {
    return (
      <Card>
        <CardContent className="space-y-3 pt-6">
          <p className="text-sm text-muted-foreground">
            익명화된 20개 차트(종목·날짜 비공개, 120봉)를 보고 각각 &ldquo;5거래일
            후 상승 확률&rdquo;을 입력합니다.
          </p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button onClick={() => void start()} disabled={phase === "loading"}>
            {phase === "loading" ? "준비 중..." : "퀴즈 시작"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (phase === "done" && result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>결과</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            당신의 Brier Score: <span className="font-semibold">{result.brierScore?.toFixed(3) ?? "—"}</span>
            {" · "}
            무작정 50% 찍었을 때: {result.coinFlipBrierScore.toFixed(3)}
          </p>
          {result.brierScore !== null && result.brierScore < result.coinFlipBrierScore ? (
            <p className="text-emerald-600">동전던지기보다 낫습니다.</p>
          ) : (
            <p className="text-amber-600">동전던지기보다 나은 예측이 아닙니다.</p>
          )}
          <Button variant="outline" onClick={() => void start()}>다시 풀기</Button>
        </CardContent>
      </Card>
    );
  }

  const question = questions[current];
  const value = answers[question.recordId] ?? 50;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          문제 {current + 1} / {questions.length}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <QuizChart bars={question.bars} />
        <div className="flex items-center gap-3">
          <label className="text-sm">5거래일 후 상승 확률 (%)</label>
          <Input
            type="number"
            min={0}
            max={100}
            className="w-24"
            value={value}
            onChange={(e) =>
              setAnswers((prev) => ({ ...prev, [question.recordId]: Number(e.target.value) }))
            }
          />
        </div>
        <div className="flex justify-end gap-2">
          {current < questions.length - 1 ? (
            <Button onClick={() => setCurrent((c) => c + 1)}>다음</Button>
          ) : (
            <Button onClick={() => void submit()} disabled={phase === "grading"}>
              {phase === "grading" ? "채점 중..." : "제출하고 채점"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
