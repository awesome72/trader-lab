"use client";

import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { calcPlannedR, calcPositionSize } from "@/lib/domain/r-multiple";

const ENTRY = 10_000;
const TARGET = ENTRY * 1.1; // +10% fixed example target
const DEMO_ACCOUNT_SIZE = 10_000_000;
const DEMO_RISK_PCT = 1;

export function RMultipleDemo() {
  const [stopPct, setStopPct] = useState(5);

  const stopPrice = Math.round(ENTRY * (1 - stopPct / 100));
  const riskPerShare = ENTRY - stopPrice;
  const plannedR = calcPlannedR(ENTRY, stopPrice, TARGET);
  const quantity = calcPositionSize(DEMO_ACCOUNT_SIZE, DEMO_RISK_PCT, ENTRY, stopPrice);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        진입가 {ENTRY.toLocaleString()}원, 목표가 {TARGET.toLocaleString()}원(고정)일 때,
        손절폭을 조절하면 R과 매수 수량이 어떻게 달라지는지 체감해보세요.
      </p>

      <div className="space-y-2">
        <label className="text-sm font-medium">손절폭: {stopPct}% (손절가 {stopPrice.toLocaleString()}원)</label>
        <Slider min={1} max={10} step={0.5} value={[stopPct]} onValueChange={(v) => setStopPct((v as number[])[0])} />
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-md border p-3 text-center text-sm">
        <div>
          <p className="text-muted-foreground">1R (손절폭)</p>
          <p className="text-lg font-semibold">{riskPerShare.toLocaleString()}원</p>
        </div>
        <div>
          <p className="text-muted-foreground">목표까지 R</p>
          <p className="text-lg font-semibold">{plannedR !== null ? `${plannedR.toFixed(2)}R` : "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">
            리스크 {DEMO_RISK_PCT}%일 때 수량
          </p>
          <p className="text-lg font-semibold">{quantity !== null ? `${quantity.toLocaleString()}주` : "—"}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        같은 목표가라도 손절폭이 좁을수록 목표까지의 R은 커지지만, 그만큼
        손절이 더 쉽게 발동됩니다. 반대로 손절폭이 넓을수록 R은 작아지지만
        같은 리스크%에서 살 수 있는 수량도 줄어듭니다.
      </p>
    </div>
  );
}
