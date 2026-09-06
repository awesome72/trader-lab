"""Per-ticker data fetching with retry/backoff, shared by backfill.py and
daily.py (docs/SPEC.md Phase 10-3: "요청 간 sleep 0.3s, 실패 시 재시도 3회").

Bulk "all tickers on one date" endpoints (both pykrx's and FinanceDataReader's)
require a KRX member login in this environment — verified directly, not
assumed. Per-ticker date-range fetches work without any login for OHLCV, so
that's the shape both collector scripts use: loop tickers, one request each.
"""
from __future__ import annotations

import time

import FinanceDataReader as fdr
import pandas as pd

from db import krx_credentials_available

SLEEP_SECONDS = 0.3
MAX_RETRIES = 3


def fetch_ohlcv_rows(ticker: str, start: str, end: str) -> list[dict]:
    """start/end: 'YYYY-MM-DD'. Returns rows shaped for db.upsert_ohlcv_daily."""
    last_error: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            df = fdr.DataReader(ticker, start, end)
            time.sleep(SLEEP_SECONDS)
            if df is None or df.empty:
                return []
            rows = []
            for date, r in df.iterrows():
                close = _num(r.get("Close"))
                volume = _num(r.get("Volume"))
                rows.append(
                    {
                        "d": date.strftime("%Y-%m-%d") if hasattr(date, "strftime") else str(date)[:10],
                        "open": _num(r.get("Open")),
                        "high": _num(r.get("High")),
                        "low": _num(r.get("Low")),
                        "close": close,
                        "volume": int(volume) if volume is not None else None,
                        "value": int(close * volume) if close is not None and volume is not None else None,
                        "adj_close": close,
                    }
                )
            return rows
        except Exception as e:  # noqa: BLE001 - broad on purpose: network/data-source errors of any shape
            last_error = e
            time.sleep(SLEEP_SECONDS)
    print(f"  ! {ticker}: OHLCV fetch failed after {MAX_RETRIES} attempts: {last_error}")
    return []


def fetch_investor_flow_rows(ticker: str, start: str, end: str) -> list[dict]:
    """Best-effort. Requires KRX_ID/KRX_PW env vars (a free KRX website
    account) — pykrx reads them directly from the environment. Returns []
    without those set, or if the KRX endpoint rejects/errors for any reason,
    rather than failing the whole collection run over optional data.
    """
    if not krx_credentials_available():
        return []

    from pykrx import stock  # imported lazily: only needed on this path

    last_error: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            start_compact = start.replace("-", "")
            end_compact = end.replace("-", "")
            df = stock.get_market_trading_value_by_date(start_compact, end_compact, ticker)
            time.sleep(SLEEP_SECONDS)
            if df is None or df.empty:
                return []
            rows = []
            for date, r in df.iterrows():
                rows.append(
                    {
                        "d": date.strftime("%Y-%m-%d") if hasattr(date, "strftime") else str(date)[:10],
                        "foreign_net": _int(r.get("외국인합계")),
                        "institution_net": _int(r.get("기관합계")),
                        "individual_net": _int(r.get("개인")),
                        "program_net": _int(r.get("프로그램매매")) if "프로그램매매" in r else None,
                    }
                )
            return rows
        except Exception as e:  # noqa: BLE001
            last_error = e
            time.sleep(SLEEP_SECONDS)
    print(f"  ! {ticker}: investor-flow fetch failed after {MAX_RETRIES} attempts: {last_error}")
    return []


def _num(value) -> float | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    return float(value)


def _int(value) -> int | None:
    n = _num(value)
    return int(n) if n is not None else None
