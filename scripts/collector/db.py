"""Shared DB access for the data collector (docs/SPEC.md Phase 10-3).

Uses plain psycopg2 against DATABASE_URL (same connection string the Node
app uses) rather than an ORM — this is a standalone Python process with no
other reason to share tooling with the TS side. All writes are upserts
(ON CONFLICT DO UPDATE), so every script here is safe to re-run.
"""
from __future__ import annotations

import os
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

_ENV_LOADED = False


def _ensure_env_loaded() -> None:
    global _ENV_LOADED
    if _ENV_LOADED:
        return
    # scripts/collector/ -> repo root is two levels up
    repo_root = Path(__file__).resolve().parents[2]
    load_dotenv(repo_root / ".env.local")
    _ENV_LOADED = True


def get_connection():
    _ensure_env_loaded()
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set (check .env.local or the environment)")
    return psycopg2.connect(database_url)


def krx_credentials_available() -> bool:
    _ensure_env_loaded()
    return bool(os.environ.get("KRX_ID")) and bool(os.environ.get("KRX_PW"))


def upsert_ticker_master(conn, rows: list[dict]) -> None:
    """rows: [{ticker, name, market, sector, listed_from, delisted_at, market_cap}]"""
    if not rows:
        return
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO ticker_master (ticker, name, market, sector, listed_from, delisted_at, market_cap)
            VALUES %s
            ON CONFLICT (ticker) DO UPDATE SET
                name = EXCLUDED.name,
                market = EXCLUDED.market,
                sector = EXCLUDED.sector,
                listed_from = COALESCE(ticker_master.listed_from, EXCLUDED.listed_from),
                market_cap = COALESCE(EXCLUDED.market_cap, ticker_master.market_cap)
            """,
            [
                (
                    r["ticker"],
                    r["name"],
                    r["market"],
                    r.get("sector"),
                    r.get("listed_from"),
                    r.get("delisted_at"),
                    r.get("market_cap"),
                )
                for r in rows
            ],
        )
    conn.commit()


def mark_delisted(conn, tickers: list[str], delisted_at: str) -> int:
    if not tickers:
        return 0
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ticker_master
            SET delisted_at = %s
            WHERE ticker = ANY(%s) AND delisted_at IS NULL
            """,
            (delisted_at, tickers),
        )
        count = cur.rowcount
    conn.commit()
    return count


def get_active_tickers(conn) -> list[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT ticker FROM ticker_master WHERE delisted_at IS NULL ORDER BY ticker")
        return [row[0] for row in cur.fetchall()]


def get_all_tickers(conn) -> list[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT ticker FROM ticker_master ORDER BY ticker")
        return [row[0] for row in cur.fetchall()]


def get_tracked_tickers(conn) -> list[str]:
    """The bounded ticker set backfill.py maintains OHLCV history for (see
    select_universe.py) — never the full ~2,765-ticker KOSPI/KOSDAQ
    universe, to keep storage proportional to what a trader would actually
    encounter rather than every listing. Includes delisted-but-tracked
    tickers on purpose (backfill.py's job is historical depth, and
    excluding them would reintroduce survivorship bias — see
    daily.py/get_tracked_active_tickers for the incremental-update case,
    which should skip them instead)."""
    with conn.cursor() as cur:
        cur.execute("SELECT ticker FROM ticker_master WHERE is_tracked = true ORDER BY ticker")
        return [row[0] for row in cur.fetchall()]


def get_tracked_active_tickers(conn) -> list[str]:
    """Same as get_tracked_tickers but excludes delisted names — what
    daily.py should loop over, since fetching new price data for a
    delisted stock can't return anything."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT ticker FROM ticker_master WHERE is_tracked = true AND delisted_at IS NULL ORDER BY ticker"
        )
        return [row[0] for row in cur.fetchall()]


def set_tracked_tickers(conn, tickers: list[str]) -> None:
    """Replaces the tracked set wholesale (untracks everything else first) —
    select_universe.py's own job is to decide the *entire* set each time it
    runs, not to incrementally add to it."""
    with conn.cursor() as cur:
        cur.execute("UPDATE ticker_master SET is_tracked = false WHERE is_tracked = true")
        if tickers:
            cur.execute("UPDATE ticker_master SET is_tracked = true WHERE ticker = ANY(%s)", (tickers,))
    conn.commit()


def delete_ohlcv_for_untracked(conn) -> int:
    """Reclaims storage from tickers select_universe.py has just dropped out
    of the tracked set (e.g. after re-ranking). Safe to call any time —
    tracked tickers are always re-fetchable via backfill.py."""
    with conn.cursor() as cur:
        cur.execute(
            """
            DELETE FROM ohlcv_daily
            WHERE ticker IN (SELECT ticker FROM ticker_master WHERE is_tracked = false)
            """
        )
        ohlcv_count = cur.rowcount
        cur.execute(
            """
            DELETE FROM investor_flow
            WHERE ticker IN (SELECT ticker FROM ticker_master WHERE is_tracked = false)
            """
        )
    conn.commit()
    return ohlcv_count


def upsert_ohlcv_daily(conn, ticker: str, rows: list[dict]) -> None:
    """rows: [{d, open, high, low, close, volume, value, adj_close}]"""
    if not rows:
        return
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO ohlcv_daily (ticker, d, open, high, low, close, volume, value, adj_close)
            VALUES %s
            ON CONFLICT (ticker, d) DO UPDATE SET
                open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low,
                close = EXCLUDED.close, volume = EXCLUDED.volume,
                value = EXCLUDED.value, adj_close = EXCLUDED.adj_close
            """,
            [
                (
                    ticker,
                    r["d"],
                    r.get("open"),
                    r.get("high"),
                    r.get("low"),
                    r.get("close"),
                    r.get("volume"),
                    r.get("value"),
                    r.get("adj_close"),
                )
                for r in rows
            ],
        )
    conn.commit()


def upsert_investor_flow(conn, ticker: str, rows: list[dict]) -> None:
    """rows: [{d, foreign_net, institution_net, individual_net, program_net}]"""
    if not rows:
        return
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO investor_flow (ticker, d, foreign_net, institution_net, individual_net, program_net)
            VALUES %s
            ON CONFLICT (ticker, d) DO UPDATE SET
                foreign_net = EXCLUDED.foreign_net,
                institution_net = EXCLUDED.institution_net,
                individual_net = EXCLUDED.individual_net,
                program_net = EXCLUDED.program_net
            """,
            [
                (
                    ticker,
                    r["d"],
                    r.get("foreign_net"),
                    r.get("institution_net"),
                    r.get("individual_net"),
                    r.get("program_net"),
                )
                for r in rows
            ],
        )
    conn.commit()
