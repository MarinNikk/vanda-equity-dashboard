from datetime import date

from app.external.twelvedata import Bar

# Reach back ~13 months on a first import so the dashboard can offer up to a year.
DEFAULT_BACKFILL_DAYS = 400

# Keyed on the (symbol, ts) PK: re-importing a day overwrites it rather than
# duplicating, and picks up late revisions.
UPSERT_SQL = """
INSERT INTO prices (symbol, ts, open, high, low, close, volume)
VALUES (%s, %s, %s, %s, %s, %s, %s)
ON CONFLICT(symbol, ts) DO UPDATE SET
    open   = excluded.open,
    high   = excluded.high,
    low    = excluded.low,
    close  = excluded.close,
    volume = excluded.volume
"""


def get_universe(conn) -> list[str]:
    return [row["symbol"] for row in conn.execute("SELECT symbol FROM symbols ORDER BY symbol")]


def get_watermark(conn, symbol: str) -> date | None:
    """Most recent stored trading day for a symbol, or None."""
    row = conn.execute(
        "SELECT MAX(ts) AS last FROM prices WHERE symbol = %s", (symbol,)
    ).fetchone()
    return row["last"]


def upsert_bars(conn, symbol: str, bars: list[Bar]) -> int:
    # Connections are autocommit, so this transaction is the explicit boundary that
    # makes one symbol's batch all-or-nothing.
    rows = [(symbol, b.ts, b.open, b.high, b.low, b.close, b.volume) for b in bars]
    with conn.transaction():
        with conn.cursor() as cur:
            cur.executemany(UPSERT_SQL, rows)
    return len(rows)
