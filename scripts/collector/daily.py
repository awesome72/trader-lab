"""매일 18:00 KST 증분 수집 (docs/SPEC.md Phase 10-3).

Fetches the last 5 calendar days (covers weekends/holidays/any missed run)
for every active (non-delisted) ticker and upserts — safe to re-run, and
cheap enough to run daily via the GitHub Actions workflow in
.github/workflows/collector.yml.

Usage: python daily.py
"""
from __future__ import annotations

import datetime

from db import get_active_tickers, get_connection, krx_credentials_available, upsert_investor_flow, upsert_ohlcv_daily
from fetch import fetch_investor_flow_rows, fetch_ohlcv_rows

LOOKBACK_DAYS = 5


def main() -> None:
    conn = get_connection()
    try:
        tickers = get_active_tickers(conn)
        if not tickers:
            print("ticker_master has no active tickers — run master.py first.")
            return

        start = (datetime.date.today() - datetime.timedelta(days=LOOKBACK_DAYS)).isoformat()
        end = datetime.date.today().isoformat()
        collect_flow = krx_credentials_available()
        print(f"daily update: {len(tickers)} active tickers, {start} to {end}")

        total_bars = 0
        for i, ticker in enumerate(tickers, start=1):
            ohlcv_rows = fetch_ohlcv_rows(ticker, start, end)
            upsert_ohlcv_daily(conn, ticker, ohlcv_rows)
            total_bars += len(ohlcv_rows)

            if collect_flow:
                flow_rows = fetch_investor_flow_rows(ticker, start, end)
                upsert_investor_flow(conn, ticker, flow_rows)

            if i % 100 == 0 or i == len(tickers):
                print(f"  [{i}/{len(tickers)}] processed")

        print(f"done: {total_bars} bar-rows upserted across {len(tickers)} tickers")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
