"""지정 기간 전종목 일봉 + 투자자 수급 초기 적재 (docs/SPEC.md Phase 10-3).

Run master.py first so ticker_master is populated — this script reads its
ticker universe from there rather than re-fetching the listing itself.

Usage:
    python master.py
    python backfill.py --start 2022-01-01 --end 2026-01-01
    python backfill.py                      # defaults to the last 2 years
"""
from __future__ import annotations

import argparse
import datetime

from db import get_all_tickers, get_connection, krx_credentials_available, upsert_investor_flow, upsert_ohlcv_daily
from fetch import fetch_investor_flow_rows, fetch_ohlcv_rows


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    two_years_ago = (datetime.date.today() - datetime.timedelta(days=365 * 2)).isoformat()
    today = datetime.date.today().isoformat()
    parser.add_argument("--start", default=two_years_ago, help="YYYY-MM-DD (default: 2 years ago)")
    parser.add_argument("--end", default=today, help="YYYY-MM-DD (default: today)")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    conn = get_connection()
    try:
        tickers = get_all_tickers(conn)
        if not tickers:
            print("ticker_master is empty — run master.py first.")
            return

        collect_flow = krx_credentials_available()
        print(f"backfilling {len(tickers)} tickers from {args.start} to {args.end}")
        print(f"investor flow collection: {'ON (KRX_ID/KRX_PW set)' if collect_flow else 'OFF (no KRX_ID/KRX_PW)'}")

        for i, ticker in enumerate(tickers, start=1):
            ohlcv_rows = fetch_ohlcv_rows(ticker, args.start, args.end)
            upsert_ohlcv_daily(conn, ticker, ohlcv_rows)

            if collect_flow:
                flow_rows = fetch_investor_flow_rows(ticker, args.start, args.end)
                upsert_investor_flow(conn, ticker, flow_rows)

            if i % 50 == 0 or i == len(tickers):
                print(f"  [{i}/{len(tickers)}] {ticker}: {len(ohlcv_rows)} bars")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
