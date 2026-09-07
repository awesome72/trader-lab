"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calcPriceRangeInWindow, type DailyBar } from "@/lib/domain/price-range";
import { EXIT_REASON_LABELS } from "@/lib/labels";
import {
  journalCloseSchema,
  type JournalCloseInput,
} from "@/lib/validation/journal";
import { closeTrade } from "./actions";

function toLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CloseForm({
  tradeId,
  entryPrice,
  entryDate,
  bars,
}: {
  tradeId: string;
  entryPrice: number;
  entryDate: string; // "YYYY-MM-DD"
  bars: DailyBar[];
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<JournalCloseInput>({
    resolver: zodResolver(journalCloseSchema),
    defaultValues: {
      exitAt: toLocalDatetimeInputValue(new Date()),
      exitReason: "discretionary",
      lowestPrice: entryPrice,
      highestPrice: entryPrice,
      invalidationTriggered: "unsure",
    },
  });

  const exitAt = watch("exitAt");

  // Real market data (scripts/collector/) beats asking the trader to
  // remember prices by hand — auto-fills whenever this ticker has coverage
  // for the entry→exit window, but the fields stay editable so a trader can
  // always override (e.g. intraday extremes a daily bar can't capture).
  useEffect(() => {
    if (bars.length === 0 || !exitAt) {
      setAutoFilled(false);
      return;
    }
    const exitDate = exitAt.slice(0, 10);
    const range = calcPriceRangeInWindow(bars, entryDate, exitDate);
    if (range) {
      setValue("lowestPrice", range.low);
      setValue("highestPrice", range.high);
      setAutoFilled(true);
    } else {
      setAutoFilled(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exitAt, bars, entryDate]);

  async function onSubmit(values: JournalCloseInput) {
    setSubmitting(true);
    setServerError(null);
    const result = await closeTrade(tradeId, values);
    if (result && !result.ok) {
      setServerError(result.error);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="exitPrice">청산가</Label>
          <Input
            id="exitPrice"
            type="number"
            step="any"
            {...register("exitPrice", { valueAsNumber: true })}
          />
          {errors.exitPrice ? (
            <p className="text-sm text-destructive">{errors.exitPrice.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="exitAt">청산 시각</Label>
          <Input id="exitAt" type="datetime-local" {...register("exitAt")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>청산 사유</Label>
        <Controller
          control={control}
          name="exitReason"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EXIT_REASON_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="lowestPrice">보유 중 최저가</Label>
          <Input
            id="lowestPrice"
            type="number"
            step="any"
            {...register("lowestPrice", { valueAsNumber: true })}
          />
          {errors.lowestPrice ? (
            <p className="text-sm text-destructive">{errors.lowestPrice.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="highestPrice">보유 중 최고가</Label>
          <Input
            id="highestPrice"
            type="number"
            step="any"
            {...register("highestPrice", { valueAsNumber: true })}
          />
          {errors.highestPrice ? (
            <p className="text-sm text-destructive">{errors.highestPrice.message}</p>
          ) : null}
        </div>
      </div>
      {autoFilled ? (
        <p className="text-xs text-muted-foreground">
          <Badge variant="outline" className="mr-1 text-emerald-600">실제 시세로 자동 계산됨</Badge>
          일봉 기준이라 장중 순간적인 극값은 반영되지 않을 수 있습니다 — 필요하면 직접 수정하세요.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          이 종목·기간의 시세 데이터가 아직 없어 보유 중 최저/최고가는 직접 입력합니다
          (MAE/MFE 계산에 사용됩니다).
        </p>
      )}

      <div className="space-y-2">
        <Label>무효화 조건이 발동했나요?</Label>
        <Controller
          control={control}
          name="invalidationTriggered"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">발동함</SelectItem>
                <SelectItem value="no">발동 안 함</SelectItem>
                <SelectItem value="unsure">모르겠음</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "저장 중..." : "청산 확정"}
      </Button>
    </form>
  );
}
