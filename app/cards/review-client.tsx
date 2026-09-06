"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SrsCard } from "@/lib/queries/srs";
import { submitReview } from "./actions";

// Anki-style 4-button grading mapped onto SM-2's 0-5 scale
// (lib/domain/srs.ts). docs/SPEC.md Phase 9-C-4: space=flip, 1-4=grade.
const GRADE_BUTTONS: { key: string; label: string; grade: number }[] = [
  { key: "1", label: "다시 (1)", grade: 0 },
  { key: "2", label: "어려움 (2)", grade: 2 },
  { key: "3", label: "보통 (3)", grade: 4 },
  { key: "4", label: "쉬움 (4)", grade: 5 },
];

export function ReviewClient({ cards }: { cards: SrsCard[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const card = cards[index];

  async function grade(g: number) {
    if (!card || submitting) return;
    setSubmitting(true);
    await submitReview(card.id, g);
    setSubmitting(false);
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!card) return;
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped(true);
        return;
      }
      if (flipped) {
        const btn = GRADE_BUTTONS.find((b) => b.key === e.key);
        if (btn) void grade(btn.grade);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, flipped, submitting]);

  if (!card) {
    return <p className="text-sm text-muted-foreground">오늘 복습할 카드를 모두 마쳤습니다.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          복습 {index + 1} / {cards.length}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="whitespace-pre-wrap rounded-md border p-4 text-sm">{card.front}</div>

        {!flipped ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setFlipped(true)}>기억남</Button>
            <Button variant="outline" onClick={() => setFlipped(true)}>애매</Button>
            <Button variant="outline" onClick={() => setFlipped(true)}>모름</Button>
          </div>
        ) : (
          <>
            <div className="whitespace-pre-wrap rounded-md border bg-muted p-4 text-sm">{card.back}</div>
            <div className="flex flex-wrap gap-2">
              {GRADE_BUTTONS.map((b) => (
                <Button key={b.key} variant="outline" onClick={() => void grade(b.grade)} disabled={submitting}>
                  {b.label}
                </Button>
              ))}
            </div>
          </>
        )}

        {card.conceptTags.length > 0 ? (
          <p className="text-xs text-muted-foreground">태그: {card.conceptTags.join(", ")}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
