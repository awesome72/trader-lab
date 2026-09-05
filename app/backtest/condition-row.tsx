"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Comparator, IndicatorRef, Operand } from "@/lib/domain/rule-dsl";

export type BuilderIndicator = "close" | "sma" | "ema" | "rsi" | "highest" | "lowest" | "volume" | "foreignNetSum";

export const INDICATOR_OPTIONS: { value: BuilderIndicator; label: string; needsPeriod: boolean }[] = [
  { value: "close", label: "종가", needsPeriod: false },
  { value: "volume", label: "거래량", needsPeriod: false },
  { value: "sma", label: "이동평균(SMA)", needsPeriod: true },
  { value: "ema", label: "지수이동평균(EMA)", needsPeriod: true },
  { value: "rsi", label: "RSI", needsPeriod: true },
  { value: "highest", label: "N일 최고가", needsPeriod: true },
  { value: "lowest", label: "N일 최저가", needsPeriod: true },
  { value: "foreignNetSum", label: "외국인 N일 누적순매수", needsPeriod: true },
];

const COMPARATORS: { value: Comparator; label: string }[] = [
  { value: ">", label: ">" },
  { value: "<", label: "<" },
  { value: ">=", label: ">=" },
  { value: "<=", label: "<=" },
];

export interface ConditionRowState {
  id: string;
  lhsIndicator: BuilderIndicator;
  lhsPeriod: number;
  cmp: Comparator;
  rhsMode: "indicator" | "const";
  rhsIndicator: BuilderIndicator;
  rhsPeriod: number;
  rhsConst: number;
  rhsMultiplier: number;
}

export function makeConditionRow(overrides: Partial<ConditionRowState> = {}): ConditionRowState {
  return {
    id: crypto.randomUUID(),
    lhsIndicator: "close",
    lhsPeriod: 20,
    cmp: ">",
    rhsMode: "indicator",
    rhsIndicator: "sma",
    rhsPeriod: 20,
    rhsConst: 0,
    rhsMultiplier: 1,
    ...overrides,
  };
}

function needsPeriod(indicator: BuilderIndicator): boolean {
  return INDICATOR_OPTIONS.find((o) => o.value === indicator)?.needsPeriod ?? false;
}

export function rowToCondition(row: ConditionRowState): { lhs: Operand; cmp: Comparator; rhs: Operand } {
  const lhs: IndicatorRef = { indicator: row.lhsIndicator };
  if (needsPeriod(row.lhsIndicator)) lhs.period = row.lhsPeriod;

  if (row.rhsMode === "const") {
    return { lhs, cmp: row.cmp, rhs: { const: row.rhsConst } };
  }

  const rhs: IndicatorRef = { indicator: row.rhsIndicator };
  if (needsPeriod(row.rhsIndicator)) rhs.period = row.rhsPeriod;
  if (row.rhsMultiplier !== 1) rhs.multiplier = row.rhsMultiplier;
  return { lhs, cmp: row.cmp, rhs };
}

export function ConditionRow({
  row,
  onChange,
  onRemove,
}: {
  row: ConditionRowState;
  onChange: (next: ConditionRowState) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
      <Select value={row.lhsIndicator} onValueChange={(v) => v && onChange({ ...row, lhsIndicator: v as BuilderIndicator })}>
        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          {INDICATOR_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {needsPeriod(row.lhsIndicator) ? (
        <Input
          type="number"
          className="w-20"
          value={row.lhsPeriod}
          onChange={(e) => onChange({ ...row, lhsPeriod: Number(e.target.value) })}
        />
      ) : null}

      <Select value={row.cmp} onValueChange={(v) => v && onChange({ ...row, cmp: v as Comparator })}>
        <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
        <SelectContent>
          {COMPARATORS.map((c) => (
            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={row.rhsMode} onValueChange={(v) => v && onChange({ ...row, rhsMode: v as "indicator" | "const" })}>
        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="indicator">지표</SelectItem>
          <SelectItem value="const">상수</SelectItem>
        </SelectContent>
      </Select>

      {row.rhsMode === "const" ? (
        <Input
          type="number"
          className="w-28"
          value={row.rhsConst}
          onChange={(e) => onChange({ ...row, rhsConst: Number(e.target.value) })}
        />
      ) : (
        <>
          <Select value={row.rhsIndicator} onValueChange={(v) => v && onChange({ ...row, rhsIndicator: v as BuilderIndicator })}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {INDICATOR_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {needsPeriod(row.rhsIndicator) ? (
            <Input
              type="number"
              className="w-20"
              value={row.rhsPeriod}
              onChange={(e) => onChange({ ...row, rhsPeriod: Number(e.target.value) })}
            />
          ) : null}
          <span className="text-xs text-muted-foreground">×</span>
          <Input
            type="number"
            step="0.1"
            className="w-20"
            value={row.rhsMultiplier}
            onChange={(e) => onChange({ ...row, rhsMultiplier: Number(e.target.value) })}
          />
        </>
      )}

      <Button variant="ghost" size="sm" onClick={onRemove}>삭제</Button>
    </div>
  );
}
