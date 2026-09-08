"""Pick the bounded set of tickers backfill.py/daily.py actually maintain
full OHLCV history for (docs/SPEC.md Phase 10-3 follow-up: keeping storage
proportional to what a trader would actually encounter, not every one of
the ~2,765 KOSPI/KOSDAQ listings).

Real market cap isn't available from any free, no-login source this
collector uses (FinanceDataReader's KRX-DESC listing has no cap column;
pykrx's per-date market-cap endpoint is one of the bulk "all tickers on one
date" calls that needs a real KRX member login — see README.md). Average
daily trading value (close * volume) from data already sitting in
ohlcv_daily is a solid real-data proxy for "major/liquid" instead: it's
exactly the same tickers a retail trader would actually recognize (verified
by inspecting the actual top of a real ranking — 삼성전자, SK하이닉스,
현대차, NAVER, ... showed up at the top, not noise).

This means ohlcv_daily needs *some* existing history to rank against before
this script is useful — see scripts/collector/README.md's "처음 설정" flow
for the recommended order (a short, full-universe fetch first, then this,
then a full-depth backfill.py restricted to the tracked set it picks).

Usage:
    python select_universe.py --top 300
"""
from __future__ import annotations

import argparse

from db import delete_ohlcv_for_untracked, get_connection, set_tracked_tickers

MIN_BARS = 30  # ignore tickers with too little history to rank meaningfully
SYNTHETIC_PREFIX = "9"  # reserved for scripts/seed-ohlcv.mjs's dev/test tickers


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--top", type=int, default=300, help="how many real tickers to track (default: 300)")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT ticker FROM ohlcv_daily
                WHERE ticker NOT LIKE %s
                GROUP BY ticker
                HAVING COUNT(*) > %s
                ORDER BY AVG(close * volume) DESC
                LIMIT %s
                """,
                (f"{SYNTHETIC_PREFIX}%", MIN_BARS, args.top),
            )
            top_real = [row[0] for row in cur.fetchall()]

            cur.execute("SELECT ticker FROM ticker_master WHERE ticker LIKE %s", (f"{SYNTHETIC_PREFIX}%",))
            synthetic = [row[0] for row in cur.fetchall()]

        if not top_real:
            print("ohlcv_daily has no rankable history yet — see this script's own docstring for setup order.")
            return

        tracked = top_real + synthetic
        set_tracked_tickers(conn, tracked)
        print(f"tracked {len(top_real)} real tickers (by avg trading value) + {len(synthetic)} synthetic dev tickers")

        reclaimed = delete_ohlcv_for_untracked(conn)
        print(f"reclaimed {reclaimed} ohlcv_daily row(s) from now-untracked tickers")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
