// Korean display labels for domain enums. UI-only, not calculation logic.
import type {
  ExitReason,
  HorizonType,
  Quadrant,
  SetupType,
  StopBasis,
} from "@/lib/domain/types";

export const SETUP_LABELS: Record<SetupType, string> = {
  breakout: "돌파",
  pullback: "눌림목",
  reversal: "역추세",
  earnings: "실적",
  flow: "수급",
  event: "이벤트",
  other: "기타",
};

export const HORIZON_LABELS: Record<HorizonType, string> = {
  scalp: "스캘핑",
  day: "데이트레이드",
  swing: "스윙 (2~10일)",
  position: "포지션 (1개월+)",
};

export const STOP_BASIS_LABELS: Record<StopBasis, string> = {
  technical: "기술적 지지선",
  atr: "ATR 배수",
  max_loss: "최대손실액",
  time: "시간손절",
};

export const EXIT_REASON_LABELS: Record<ExitReason, string> = {
  stop: "손절",
  target: "목표",
  discretionary: "재량",
  time: "시간",
};

export const QUADRANT_LABELS: Record<Quadrant, string> = {
  skill: "실력",
  luck: "행운",
  badluck: "불운",
  mistake: "실수",
};

export const EMOTION_TAGS: { value: string; label: string }[] = [
  { value: "calm", label: "평온" },
  { value: "impatient", label: "조급" },
  { value: "fomo", label: "FOMO" },
  { value: "revenge", label: "복수심" },
  { value: "confident", label: "자신만만" },
  { value: "anxious", label: "불안" },
  { value: "bored", label: "지루함" },
];

export const EMOTION_LABELS: Record<string, string> = Object.fromEntries(
  EMOTION_TAGS.map((t) => [t.value, t.label])
);

export const INVALIDATION_PLACEHOLDERS = [
  "종가가 20일 이동평균선 아래로 마감하면",
  "거래량 감소 상태로 3거래일 횡보하면",
  "실적 발표 후 갭하락으로 시작하면",
];
