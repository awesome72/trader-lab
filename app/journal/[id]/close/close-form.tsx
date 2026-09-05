"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
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
}: {
  tradeId: string;
  entryPrice: number;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
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
      <p className="text-xs text-muted-foreground">
        아직 시세 데이터가 연동되지 않아 보유 중 최저/최고가는 직접 입력합니다
        (MAE/MFE 계산에 사용됩니다).
      </p>

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
