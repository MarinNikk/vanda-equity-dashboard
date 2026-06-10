"""Symbol/price queries and the derived summary.

The summary is computed server-side so the numbers have one source of truth. The
frontend mirrors build_summary (frontend/src/lib/summary.ts) to re-derive stats
for a navigator-selected sub-range — keep the two in lockstep.
"""

from datetime import date

from app.models.market import Bar, Summary


def list_symbols(conn) -> list[dict]:
    rows = conn.execute(
        "SELECT symbol, name, is_default FROM symbols ORDER BY symbol"
    ).fetchall()
    return [
        {"symbol": r["symbol"], "name": r["name"], "is_default": bool(r["is_default"])}
        for r in rows
    ]


def symbol_exists(conn, symbol: str) -> bool:
    return conn.execute(
        "SELECT 1 FROM symbols WHERE symbol = %s", (symbol,)
    ).fetchone() is not None


def get_price_bars(conn, symbol: str, from_date: date, to_date: date) -> list[Bar]:
    rows = conn.execute(
        """
        SELECT ts, open, high, low, close, volume
        FROM prices
        WHERE symbol = %s AND ts BETWEEN %s AND %s
        ORDER BY ts ASC
        """,
        (symbol, from_date, to_date),
    ).fetchall()
    return [
        Bar(
            ts=r["ts"].isoformat(),  # DATE -> 'YYYY-MM-DD'
            open=r["open"],
            high=r["high"],
            low=r["low"],
            close=r["close"],
            volume=r["volume"],
        )
        for r in rows
    ]


def build_summary(bars: list[Bar]) -> Summary:
    """Derived stats from an ascending list of bars."""
    start_close = bars[0].close
    end_close = bars[-1].close
    pct_change = ((end_close - start_close) / start_close * 100) if start_close else 0.0
    return Summary(
        start_date=bars[0].ts,
        end_date=bars[-1].ts,
        start_close=start_close,
        end_close=end_close,
        pct_change=round(pct_change, 4),
        high=max(b.high for b in bars),
        low=min(b.low for b in bars),
        cumulative_volume=sum(b.volume for b in bars),
        count=len(bars),
    )
