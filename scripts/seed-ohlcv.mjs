// Seeds ticker_master/ohlcv_daily/investor_flow with deterministic SYNTHETIC
// data so app/replay (Phase 6) has something to run against locally.
//
// This is a stopgap: docs/SPEC.md Phase 10 (scripts/collector/, Python +
// pykrx/FinanceDataReader) is the real market-data pipeline. None of the
// tickers or prices here are real; ticker codes are in the 9-prefixed range
// so they can never collide with a real KRX code.
//
// Usage: npm run db:seed-ohlcv
import postgres from "postgres";

try {
  process.loadEnvFile(".env.local");
} catch {
  // optional in CI
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set (check .env.local)");
}

// Same PRNG as lib/domain/*.ts (mulberry32) so the walk is reproducible.
function mulberry32(seed) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TICKERS = [
  { ticker: "900001", name: "테스트전자", market: "KOSPI", start: 42000, seed: 1, delisted: false },
  { ticker: "900002", name: "테스트바이오", market: "KOSDAQ", start: 18000, seed: 2, delisted: false },
  { ticker: "900003", name: "테스트조선", market: "KOSPI", start: 9500, seed: 3, delisted: true },
];

const TRADING_DAYS = 400; // ~ 1.5 calendar years, weekends skipped
const START_DATE = new Date("2024-01-02T00:00:00Z");

function nextTradingDay(d) {
  const next = new Date(d);
  do {
    next.setUTCDate(next.getUTCDate() + 1);
  } while (next.getUTCDay() === 0 || next.getUTCDay() === 6);
  return next;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function buildSeries(cfg) {
  const rand = mulberry32(cfg.seed);
  const rows = [];
  let close = cfg.start;
  let date = new Date(START_DATE);

  for (let i = 0; i < TRADING_DAYS; i++) {
    if (i > 0) date = nextTradingDay(date);

    // Daily drift + noise random walk, clamped to +/-15% like KRX limits.
    const pctChange = (rand() - 0.48) * 0.06;
    const clamped = Math.max(-0.15, Math.min(0.15, pctChange));
    const open = close;
    close = Math.max(100, Math.round(open * (1 + clamped)));
    const high = Math.round(Math.max(open, close) * (1 + rand() * 0.015));
    const low = Math.round(Math.min(open, close) * (1 - rand() * 0.015));
    const volume = Math.round(50_000 + rand() * 500_000);
    const value = volume * close;

    rows.push({
      ticker: cfg.ticker,
      d: isoDate(date),
      open,
      high,
      low,
      close,
      volume,
      value,
      adj_close: close,
    });
  }
  return rows;
}

function buildInvestorFlow(cfg, ohlcvRows) {
  const rand = mulberry32(cfg.seed + 1000);
  return ohlcvRows.map((row) => {
    const foreignNet = Math.round((rand() - 0.5) * 2 * row.volume * 0.2);
    const institutionNet = Math.round((rand() - 0.5) * 2 * row.volume * 0.15);
    const programNet = Math.round((rand() - 0.5) * 2 * row.volume * 0.05);
    const individualNet = -(foreignNet + institutionNet + programNet);
    return {
      ticker: cfg.ticker,
      d: row.d,
      foreign_net: foreignNet,
      institution_net: institutionNet,
      individual_net: individualNet,
      program_net: programNet,
    };
  });
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { prepare: false });

  try {
    for (const cfg of TICKERS) {
      const ohlcvRows = buildSeries(cfg);
      const flowRows = buildInvestorFlow(cfg, ohlcvRows);
      const lastDate = ohlcvRows[ohlcvRows.length - 1].d;

      await sql`
        INSERT INTO ticker_master (ticker, name, market, sector, listed_from, delisted_at, market_cap)
        VALUES (${cfg.ticker}, ${cfg.name}, ${cfg.market}, ${"기타"}, ${ohlcvRows[0].d},
                ${cfg.delisted ? lastDate : null}, ${300_000_000_000})
        ON CONFLICT (ticker) DO UPDATE SET
          name = excluded.name,
          market = excluded.market,
          delisted_at = excluded.delisted_at,
          market_cap = excluded.market_cap
      `;

      await sql`
        INSERT INTO ohlcv_daily ${sql(ohlcvRows, "ticker", "d", "open", "high", "low", "close", "volume", "value", "adj_close")}
        ON CONFLICT (ticker, d) DO UPDATE SET
          open = excluded.open, high = excluded.high, low = excluded.low,
          close = excluded.close, volume = excluded.volume, value = excluded.value,
          adj_close = excluded.adj_close
      `;

      await sql`
        INSERT INTO investor_flow ${sql(flowRows, "ticker", "d", "foreign_net", "institution_net", "individual_net", "program_net")}
        ON CONFLICT (ticker, d) DO UPDATE SET
          foreign_net = excluded.foreign_net,
          institution_net = excluded.institution_net,
          individual_net = excluded.individual_net,
          program_net = excluded.program_net
      `;

      console.log(
        `seeded ${cfg.ticker} (${cfg.name}): ${ohlcvRows.length} bars${cfg.delisted ? ", delisted " + lastDate : ""}`
      );
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
