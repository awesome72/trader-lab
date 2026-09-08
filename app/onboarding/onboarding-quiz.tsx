"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { QuizChart } from "@/app/calibration/quiz/quiz-chart";
import { completeOnboarding } from "./actions";

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
interface SubmitResponse {
  results: { squaredError: number }[];
  brierScore: number | null;
  coinFlipBrierScore: number;
}

const QUESTION_COUNT = 10;

export function OnboardingQuiz() {
  const router = useRouter();
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
      const res = await fetch("/api/calibration/quiz/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: QUESTION_COUNT }),
      });
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

  async function finish() {
    await completeOnboarding();
    router.push("/?onboarded=1");
  }

  if (phase === "idle" || phase === "loading") {
    return (
      <Card>
        <CardContent className="space-y-3 pt-6">
          <p className="text-sm text-muted-foreground">
            마지막 단계입니다. 익명화된 차트 10개를 보고 &ldquo;5거래일 후
            상승 확률&rdquo;을 입력해 베이스라인 Brier Score를 기록합니다.
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
          <CardTitle>베이스라인 Brier Score</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            당신의 Brier Score: <span className="font-semibold">{result.brierScore?.toFixed(3) ?? "—"}</span>
            {" · "}
            무작정 50% 찍었을 때: {result.coinFlipBrierScore.toFixed(3)}
          </p>
          <p className="text-muted-foreground">
            이 값이 앞으로 캘리브레이션 트레이너에서 개선을 추적할 출발점입니다.
          </p>
          <Button onClick={() => void finish()}>온보딩 완료</Button>
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
            onChange={(e) => setAnswers((prev) => ({ ...prev, [question.recordId]: Number(e.target.value) }))}
          />
        </div>
        <div className="flex justify-end">
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
