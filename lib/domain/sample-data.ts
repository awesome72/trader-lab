import type { ProcessScoreBreakdown } from "./process-score";
import type { Quadrant, Trade } from "./types";

// A brand-new account has nothing in journal/scorecard/metrics/bias until
// ~30 real trades accumulate — this generates a fixed, clearly-labeled
// sample trade set so a trader can see what a filled-in scorecard/metrics
// page actually looks like before they've logged anything real. Never
// written to the DB; pages that support it accept a "?sample=1" query
// param and render this instead of a real DB fetch (see app/scorecard,
// app/metrics). `asOf` is injected per this module's own domain-purity
// rule (no Date.now()) — callers pass `new Date()` from a Server Component.

// Deterministic PRNG, not Math.random() — same seed always produces the
// same sample set (lib/domain/metrics.ts and monte-carlo.ts use the same
// pattern for the same reason).
function mulberry32(seed: number): () => number {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const QUADRANT_BUCKETS: {
  quadrant: Quadrant;
  processRange: [number, number];
  rRange: [number, number];
  emotion: string;
}[] = [
  { quadrant: "skill", processRange: [75, 95], rRange: [0.5, 3], emotion: "calm" },
  { quadrant: "luck", processRange: [35, 55], rRange: [0.3, 2.5], emotion: "confident" },
  { quadrant: "badluck", processRange: [75, 95], rRange: [-2, -0.3], emotion: "anxious" },
  { quadrant: "mistake", processRange: [30, 55], rRange: [-2.5, -0.3], emotion: "revenge" },
];

const BREAKDOWN_MAX: ProcessScoreBreakdown = {
  hasPlan: 20,
  invalidationQuality: 15,
  stopDiscipline: 25,
  sizing: 15,
  noAveragingDown: 10,
  horizonRespect: 10,
  emotion: 5,
};

function breakdownFor(processScore: number): ProcessScoreBreakdown {
  const ratio = processScore / 100;
  return {
    hasPlan: Math.round(BREAKDOWN_MAX.hasPlan * ratio),
    invalidationQuality: Math.round(BREAKDOWN_MAX.invalidationQuality * ratio),
    stopDiscipline: Math.round(BREAKDOWN_MAX.stopDiscipline * ratio),
    sizing: Math.round(BREAKDOWN_MAX.sizing * ratio),
    noAveragingDown: Math.round(BREAKDOWN_MAX.noAveragingDown * ratio),
    horizonRespect: Math.round(BREAKDOWN_MAX.horizonRespect * ratio),
    emotion: Math.round(BREAKDOWN_MAX.emotion * ratio),
  };
}

export function generateSampleTrades(asOf: Date, count = 40): Trade[] {
  const rand = mulberry32(42);
  const trades: Trade[] = [];

  for (let i = 0; i < count; i++) {
    const bucket = QUADRANT_BUCKETS[i % QUADRANT_BUCKETS.length];
    const processScore = Math.round(
      bucket.processRange[0] + rand() * (bucket.processRange[1] - bucket.processRange[0])
    );
    const realizedR =
      Math.round(
        (bucket.rRange[0] + rand() * (bucket.rRange[1] - bucket.rRange[0])) * 100
      ) / 100;

    // Oldest trade first, ending near `asOf` — spread over ~80 days.
    const daysAgo = (count - 1 - i) * 2;
    const entryAt = new Date(asOf.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const holdDays = 1 + Math.floor(rand() * 4);
    const exitAt = new Date(
      Math.min(entryAt.getTime() + holdDays * 24 * 60 * 60 * 1000, asOf.getTime())
    );

    const entryPrice = 50_000;
    const stopPrice = 49_000;
    const riskPerShare = entryPrice - stopPrice;
    const quantity = 10;
    const exitPrice = entryPrice + realizedR * riskPerShare;
    const realizedPnl = realizedR * riskPerShare * quantity;

    trades.push({
      id: `sample-${i}`,
      userId: "sample-user",
      source: "live",
      ticker: "SAMPLE",
      maskedLabel: null,
      status: "closed",
      replaySessionId: null,

      entryAt: entryAt.toISOString(),
      entryPrice,
      quantity,
      direction: "long",

      thesis:
        "샘플 데이터: 이동평균 돌파와 거래량 증가를 근거로 진입한 가상의 거래입니다. 실제 계정 데이터가 아닙니다.",
      setup: "breakout",
      horizon: "swing",
      invalidation: "종가가 20일 이동평균선 아래로 마감하면 무효화 (샘플)",
      stopPrice,
      stopBasis: "technical",
      target1Price: null,
      target2Price: null,
      confidence: Math.round(40 + rand() * 50),
      plannedRiskPct: 1,
      plannedRMultiple: 2,

      emotionTags: [bucket.emotion],
      prevTradePnlR: null,
      conditionScore: null,

      exitAt: exitAt.toISOString(),
      exitPrice,
      exitReason: realizedR >= 0 ? "target" : "stop",
      realizedR,
      realizedPnl,
      maeR: Math.min(0, realizedR) - 0.2,
      mfeR: Math.max(0, realizedR) + 0.3,

      processScore,
      processBreakdown: breakdownFor(processScore) as unknown as Record<string, number>,
      quadrant: bucket.quadrant,

      journalLockedAt: entryAt.toISOString(),
      createdAt: entryAt.toISOString(),
    });
  }

  return trades;
}
