"""종목 마스터 갱신 (docs/SPEC.md Phase 10-3: master.py).

FinanceDataReader's KRX-DESC listing needs no login and gives us
code/name/market/sector/listing-date for every currently-listed KOSPI/KOSDAQ
name. Delisting isn't directly reported by any free source this collector
uses, so it's inferred: any ticker already in ticker_master (not yet marked
delisted) that no longer appears in today's active listing is marked
delisted as of today. That's an approximation (the exact delisting date is
unknown), but it's the best signal available without a paid data feed, and
it's what unblocks docs/SPEC.md's survivorship-bias requirement (Phase 6
replay / Phase 7 backtest both need delisted tickers in the universe).

Usage: python master.py
"""
from __future__ import annotations

import datetime
import sys

import FinanceDataReader as fdr

from db import get_all_tickers, get_connection, mark_delisted, upsert_ticker_master

INCLUDED_MARKETS = {"KOSPI", "KOSDAQ", "KOSDAQ GLOBAL"}
MARKET_LABEL = {"KOSPI": "KOSPI", "KOSDAQ": "KOSDAQ", "KOSDAQ GLOBAL": "KOSDAQ"}


def fetch_active_listing() -> list[dict]:
    df = fdr.StockListing("KRX-DESC")
    df = df[df["Market"].isin(INCLUDED_MARKETS)]

    rows = []
    for _, r in df.iterrows():
        listed_from = None
        if isinstance(r.get("ListingDate"), str) and r["ListingDate"]:
            listed_from = r["ListingDate"]
        rows.append(
            {
                "ticker": r["Code"],
                "name": r["Name"],
                "market": MARKET_LABEL[r["Market"]],
                "sector": r.get("Sector") or None,
                "listed_from": listed_from,
                "delisted_at": None,
                "market_cap": None,
            }
        )
    return rows


def main() -> None:
    conn = get_connection()
    try:
        active_rows = fetch_active_listing()
        if not active_rows:
            print("No active listing rows fetched — aborting without writing anything.", file=sys.stderr)
            sys.exit(1)

        upsert_ticker_master(conn, active_rows)
        print(f"upserted {len(active_rows)} active tickers")

        active_tickers = {r["ticker"] for r in active_rows}
        known_tickers = set(get_all_tickers(conn))
        # scripts/seed-ohlcv.mjs reserves the 9-prefixed range for synthetic
        # dev/test tickers (900001 etc.). That range also happens to be
        # real KRX's block for foreign-incorporated listings (confirmed live:
        # e.g. 900290/950170 are real companies) — so excluding it here trades
        # away delisting-detection for that narrow real subset in order to
        # never mark our synthetic tickers delisted (verified live: without
        # this exclusion, a real run immediately flagged 900001-900003 as
        # delisted since they're absent from any real KRX listing, which
        # would have broken Phase 6/7/9's synthetic dataset).
        known_tickers = {t for t in known_tickers if not t.startswith("9")}
        newly_delisted = sorted(known_tickers - active_tickers)

        today = datetime.date.today().isoformat()
        count = mark_delisted(conn, newly_delisted, today)
        if count:
            print(f"marked {count} ticker(s) delisted as of {today}: {newly_delisted}")
        else:
            print("no newly delisted tickers detected")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
