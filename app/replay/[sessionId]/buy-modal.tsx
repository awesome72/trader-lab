"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { replayEntrySchema, type ReplayEntryInput } from "@/lib/validation/journal";

export function BuyModal({
  open,
  onOpenChange,
  currentPrice,
  onSubmit,
  submitting,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPrice: number;
  onSubmit: (input: ReplayEntryInput) => void;
  submitting: boolean;
  error: string | null;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ReplayEntryInput>({
    resolver: zodResolver(replayEntrySchema),
    defaultValues: { thesis: "", invalidation: "", confidence: 60 },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>진입 전 선언 (현재가 {currentPrice.toLocaleString()})</DialogTitle>
          <DialogDescription>
            입력 없이는 진입할 수 없습니다. 선언한 손절가는 이후 그대로 채점에 쓰입니다.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={handleSubmit((values) => onSubmit(values))}
        >
          <div className="space-y-1.5">
            <Label htmlFor="thesis">논거 (30자+)</Label>
            <Textarea id="thesis" rows={3} {...register("thesis")} />
            {errors.thesis ? (
              <p className="text-xs text-destructive">{errors.thesis.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invalidation">무효화 조건 (20자+)</Label>
            <Textarea id="invalidation" rows={2} {...register("invalidation")} />
            {errors.invalidation ? (
              <p className="text-xs text-destructive">{errors.invalidation.message}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="stopPrice">손절가</Label>
              <Input
                id="stopPrice"
                type="number"
                step="any"
                {...register("stopPrice", { valueAsNumber: true })}
              />
              {errors.stopPrice ? (
                <p className="text-xs text-destructive">{errors.stopPrice.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target1Price">목표가 (선택)</Label>
              <Input
                id="target1Price"
                type="number"
                step="any"
                {...register("target1Price", {
                  setValueAs: (v) => (v === "" ? undefined : Number(v)),
                })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confidence">확신도 (0~100)</Label>
            <Input
              id="confidence"
              type="number"
              min={0}
              max={100}
              {...register("confidence", { valueAsNumber: true })}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter className="mt-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "진입하는 중..." : "매수"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
