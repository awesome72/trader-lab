"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { CoachKind, CoachOutput } from "@/lib/domain/coach";
import { saveQuestionAnswer } from "./actions";

function QuestionAnswer({ tradeId, question }: { tradeId: string; question: string }) {
  const [answer, setAnswer] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await saveQuestionAnswer(tradeId, question, answer);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    setSaved(true);
    toast.success("저장되었습니다");
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm">{question}</p>
      <Textarea
        rows={2}
        value={answer}
        onChange={(e) => {
          setAnswer(e.target.value);
          setSaved(false);
        }}
        placeholder="당신의 답변을 적어보세요."
      />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => void handleSave()} disabled={saving || !answer.trim()}>
          {saving ? "저장 중..." : "저널에 기록"}
        </Button>
        {saved ? <span className="text-xs text-emerald-600">저장됨</span> : null}
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </div>
    </div>
  );
}

function CoachOutputCards({ output, tradeId }: { output: CoachOutput; tradeId?: string }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">① 관찰</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {output.observations.map((o, i) => (
            <div key={i} className="border-b pb-2 last:border-0">
              <p className="font-medium">{o.claim}</p>
              <p className="text-muted-foreground">근거: {o.evidence}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">② 질문</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {output.questions.map((q, i) =>
            tradeId ? (
              <QuestionAnswer key={i} tradeId={tradeId} question={q} />
            ) : (
              <p key={i} className="text-sm">{q}</p>
            )
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">③ 개념: {output.concept.name}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{output.concept.explanation}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">④ 실험</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p><span className="font-medium">규칙: </span>{output.experiment.rule}</p>
          <p><span className="font-medium">기간: </span>{output.experiment.duration}</p>
          <p><span className="font-medium">성공 기준: </span>{output.experiment.successMetric}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function CoachPanel({
  kind,
  tradeId,
  triggerLabel,
}: {
  kind: CoachKind;
  tradeId?: string;
  triggerLabel: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<CoachOutput | null>(null);
  const [cached, setCached] = useState(false);

  async function handleRequest() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, tradeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "AI 코치를 불러올 수 없습니다.");
        return;
      }
      setOutput(data.output);
      setCached(!!data.cached);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => void handleRequest()} disabled={loading}>
          {loading ? "분석 중..." : triggerLabel}
        </Button>
        {cached ? <Badge variant="secondary">캐시된 결과</Badge> : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {output ? <CoachOutputCards output={output} tradeId={tradeId} /> : null}
    </div>
  );
}
