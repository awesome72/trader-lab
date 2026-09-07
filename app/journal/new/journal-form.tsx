"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  calcPlannedR,
  calcPositionSize,
  calcRiskAmount,
} from "@/lib/domain/r-multiple";
import {
  EMOTION_TAGS,
  HORIZON_LABELS,
  INVALIDATION_PLACEHOLDERS,
  SETUP_LABELS,
  STOP_BASIS_LABELS,
} from "@/lib/labels";
import {
  isInvalidationVerifiable,
  journalEntrySchema,
  type JournalEntryInput,
} from "@/lib/validation/journal";
import { createTrade } from "./actions";

function toLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function JournalForm({
  accountSize,
  defaultRiskPct,
  maxRiskPct,
  prevTradeWarning,
  prevTradeRealizedR,
}: {
  accountSize: number;
  defaultRiskPct: number;
  maxRiskPct: number;
  prevTradeWarning: string | null;
  prevTradeRealizedR: number | null;
}) {
  const [placeholderIndex] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<JournalEntryInput>({
    resolver: zodResolver(journalEntrySchema),
    defaultValues: {
      direction: "long",
      entryAt: toLocalDatetimeInputValue(new Date()),
      setup: "breakout",
      horizon: "swing",
      stopBasis: "technical",
      confidence: 50,
      plannedRiskPct: defaultRiskPct,
      emotionTags: [],
    },
  });

  const [entryPrice, stopPrice, target1Price, plannedRiskPct, invalidation] =
    watch([
      "entryPrice",
      "stopPrice",
      "target1Price",
      "plannedRiskPct",
      "invalidation",
    ]);

  const plannedR = useMemo(() => {
    if (!entryPrice || !stopPrice || !target1Price) return null;
    return calcPlannedR(Number(entryPrice), Number(stopPrice), Number(target1Price));
  }, [entryPrice, stopPrice, target1Price]);

  const suggestedQuantity = useMemo(() => {
    if (!entryPrice || !stopPrice || !plannedRiskPct) return null;
    return calcPositionSize(
      accountSize,
      Number(plannedRiskPct),
      Number(entryPrice),
      Number(stopPrice)
    );
  }, [accountSize, entryPrice, stopPrice, plannedRiskPct]);

  const riskAmount = plannedRiskPct
    ? calcRiskAmount(accountSize, Number(plannedRiskPct))
    : null;

  const invalidationLooksVerifiable = invalidation
    ? isInvalidationVerifiable(invalidation)
    : true;

  async function onSubmit(values: JournalEntryInput) {
    setSubmitting(true);
    setServerError(null);
    const result = await createTrade(values);
    if (result && !result.ok) {
      setServerError(result.error);
      setSubmitting(false);
    }
    // on success, createTrade redirects — no need to reset submitting state.
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {prevTradeWarning ? (
        <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {prevTradeWarning}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>진입</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ticker">종목 코드</Label>
            <Input id="ticker" {...register("ticker")} placeholder="005930" />
            {errors.ticker ? (
              <p className="text-sm text-destructive">{errors.ticker.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>방향</Label>
            <Controller
              control={control}
              name="direction"
              render={({ field }) => (
                <ToggleGroup
                  value={[field.value]}
                  onValueChange={(v) => {
                    if (v[0]) field.onChange(v[0]);
                  }}
                >
                  <ToggleGroupItem value="long">롱</ToggleGroupItem>
                  <ToggleGroupItem value="short">숏</ToggleGroupItem>
                </ToggleGroup>
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="entryPrice">진입가</Label>
            <Input
              id="entryPrice"
              type="number"
              step="any"
              {...register("entryPrice", { valueAsNumber: true })}
            />
            {errors.entryPrice ? (
              <p className="text-sm text-destructive">{errors.entryPrice.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantity">
              수량
              {suggestedQuantity !== null ? (
                <span className="ml-2 font-normal text-muted-foreground">
                  (권장 {suggestedQuantity.toLocaleString()}주)
                </span>
              ) : null}
            </Label>
            <Input
              id="quantity"
              type="number"
              {...register("quantity", { valueAsNumber: true })}
            />
            {errors.quantity ? (
              <p className="text-sm text-destructive">{errors.quantity.message}</p>
            ) : null}
          </div>
          <div className="col-span-2 space-y-2">
            <Label htmlFor="entryAt">체결 시각</Label>
            <Input id="entryAt" type="datetime-local" {...register("entryAt")} />
            <p className="text-xs text-muted-foreground">
              체결 후 30분 안에 저장해야 프로세스 점수의 &apos;사전 계획&apos; 항목이
              만점 처리됩니다.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>가설</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="thesis">진입 논거 (최소 50자)</Label>
            <Textarea id="thesis" rows={4} {...register("thesis")} />
            {errors.thesis ? (
              <p className="text-sm text-destructive">{errors.thesis.message}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>무효화 (가장 중요)</CardTitle>
          <CardDescription>
            &quot;무엇이 보이면 내가 틀린 것인가&quot;를 미리 선언하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invalidation">무효화 조건 (최소 20자)</Label>
            <Textarea
              id="invalidation"
              rows={3}
              placeholder={INVALIDATION_PLACEHOLDERS[placeholderIndex]}
              {...register("invalidation")}
            />
            {errors.invalidation ? (
              <p className="text-sm text-destructive">
                {errors.invalidation.message}
              </p>
            ) : !invalidationLooksVerifiable ? (
              <Badge variant="outline" className="text-amber-600">
                검증 가능한 조건인가요? 나중에 &apos;발동했는지&apos; 판정할 수
                있어야 합니다.
              </Badge>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="stopPrice">손절가</Label>
            <Input
              id="stopPrice"
              type="number"
              step="any"
              {...register("stopPrice", { valueAsNumber: true })}
            />
            {errors.stopPrice ? (
              <p className="text-sm text-destructive">
                {errors.stopPrice.message}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>기대</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="target1Price">목표가 1</Label>
            <Input
              id="target1Price"
              type="number"
              step="any"
              {...register("target1Price", {
                setValueAs: (v) => (v === "" ? undefined : Number(v)),
              })}
            />
          </div>

          {plannedR !== null ? (
            <p className="text-sm">
              예상 R-multiple:{" "}
              <span className="font-semibold">{plannedR.toFixed(2)}R</span>
              {plannedR < 1.5 ? (
                <span className="ml-2 text-amber-600">
                  손익비 1.5 미만입니다. 승률 60% 이상이어야 기대값이 양수가
                  됩니다.
                </span>
              ) : null}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label>확신도</Label>
            <Controller
              control={control}
              name="confidence"
              render={({ field }) => (
                <div className="flex items-center gap-4">
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={[field.value ?? 50]}
                    onValueChange={(v) => field.onChange((v as number[])[0])}
                    className="max-w-sm"
                  />
                  <span className="w-12 text-right text-sm">
                    {field.value ?? 50}%
                  </span>
                </div>
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>사이징</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plannedRiskPct">계좌 대비 리스크 %</Label>
            <Input
              id="plannedRiskPct"
              type="number"
              step="0.1"
              {...register("plannedRiskPct", { valueAsNumber: true })}
            />
            {plannedRiskPct && Number(plannedRiskPct) > maxRiskPct ? (
              <p className="text-sm font-medium text-destructive">
                설정된 최대 리스크 {maxRiskPct}%를 초과했습니다.
              </p>
            ) : null}
            {errors.plannedRiskPct ? (
              <p className="text-sm text-destructive">
                {errors.plannedRiskPct.message}
              </p>
            ) : null}
          </div>
          {riskAmount !== null ? (
            <p className="text-sm text-muted-foreground">
              리스크 금액: {Math.round(riskAmount).toLocaleString()}원 · 계좌
              규모: {accountSize.toLocaleString()}원
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>상태</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            직전 거래 손익:{" "}
            {prevTradeRealizedR !== null
              ? `${prevTradeRealizedR.toFixed(2)}R`
              : "기록 없음"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Accordion>
            <AccordionItem value="advanced">
              <AccordionTrigger>고급 옵션 (선택, 건너뛰면 기본값이 적용됩니다)</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>셋업 유형</Label>
                      <Controller
                        control={control}
                        name="setup"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(SETUP_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>시간 지평</Label>
                      <Controller
                        control={control}
                        name="horizon"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(HORIZON_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>손절 근거</Label>
                    <Controller
                      control={control}
                      name="stopBasis"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STOP_BASIS_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="target2Price">목표가 2</Label>
                    <Input
                      id="target2Price"
                      type="number"
                      step="any"
                      {...register("target2Price", {
                        setValueAs: (v) => (v === "" ? undefined : Number(v)),
                      })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>감정 태그</Label>
                    <Controller
                      control={control}
                      name="emotionTags"
                      render={({ field }) => (
                        <ToggleGroup
                          multiple
                          value={field.value}
                          onValueChange={field.onChange}
                          className="flex-wrap"
                        >
                          {EMOTION_TAGS.map((tag) => (
                            <ToggleGroupItem key={tag.value} value={tag.value}>
                              {tag.label}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="conditionScore">수면/컨디션 (1~5)</Label>
                    <Input
                      id="conditionScore"
                      type="number"
                      min={1}
                      max={5}
                      {...register("conditionScore", {
                        setValueAs: (v) => (v === "" ? undefined : Number(v)),
                      })}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {serverError ? (
        <p className="text-sm text-destructive">{serverError}</p>
      ) : null}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "저장 중..." : "저장 (저장 후 핵심 필드 수정 불가)"}
      </Button>
    </form>
  );
}
