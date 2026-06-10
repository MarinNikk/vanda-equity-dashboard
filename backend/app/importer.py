"""Daily OHLCV importer (CLI). Safe to re-run: incremental watermark + idempotent UPSERT.

    python -m app.importer                # incremental import of the full universe
    python -m app.importer AAPL MSFT      # just these symbols
    python -m app.importer --full-refresh # ignore watermarks, re-fetch the window
"""

import argparse
import sys
import time
from datetime import date, timedelta

from app.core.config import settings
from app.db.database import connect, init_db
from app.external import twelvedata
from app.services import ingest


def import_symbol(conn, symbol: str, api_key: str, *, full_refresh: bool = False) -> int:
    """Fetch and UPSERT one symbol. Returns the number of bars written."""
    watermark = None if full_refresh else ingest.get_watermark(conn, symbol)
    if watermark:
        # Re-fetch from the last stored day inclusive — cheap, and the overlap lets
        # the UPSERT pick up any late revision to that day.
        start_date = watermark.isoformat()
    else:
        start_date = (date.today() - timedelta(days=ingest.DEFAULT_BACKFILL_DAYS)).isoformat()

    bars = twelvedata.fetch_daily(symbol, api_key, start_date=start_date)
    if not bars:
        return 0  # genuine no-data, not a failure

    return ingest.upsert_bars(conn, symbol, bars)


def run(symbols: list[str] | None = None, *, full_refresh: bool = False, sleep_between: float = 0.0) -> int:
    """Import the given symbols (or the whole universe). Returns a process exit code."""
    api_key = settings.twelvedata_api_key
    if not api_key:
        print("ERROR: TWELVEDATA_API_KEY is not set. Add it to backend/.env", file=sys.stderr)
        return 1

    init_db()  # works on a fresh clone before the API has run
    conn = connect()
    try:
        universe = symbols or ingest.get_universe(conn)
        ok, failures = 0, []
        for i, symbol in enumerate(universe):
            try:
                n = import_symbol(conn, symbol, api_key, full_refresh=full_refresh)
                print(f"  {symbol}: upserted {n} bars")
                ok += 1
            except twelvedata.TwelvedataError as e:
                print(f"  {symbol}: API error (code={e.code}): {e}", file=sys.stderr)
                failures.append(symbol)
            except Exception as e:  # noqa: BLE001 — isolate any per-symbol failure
                print(f"  {symbol}: unexpected error: {e}", file=sys.stderr)
                failures.append(symbol)

            if sleep_between and i < len(universe) - 1:
                time.sleep(sleep_between)

        summary = f"Done. {ok}/{len(universe)} symbols ok"
        if failures:
            summary += f", failed: {failures}"
        print(summary)
        return 0 if not failures else 2
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Import daily OHLCV from Twelvedata into the local store.")
    parser.add_argument("symbols", nargs="*", help="Specific symbols (default: the full universe)")
    parser.add_argument("--full-refresh", action="store_true", help="Ignore watermarks and re-fetch the backfill window")
    parser.add_argument("--sleep", type=float, default=0.0, help="Seconds to sleep between symbols (rate-limit safety)")
    args = parser.parse_args()

    chosen = [s.upper() for s in args.symbols] or None
    raise SystemExit(run(chosen, full_refresh=args.full_refresh, sleep_between=args.sleep))


if __name__ == "__main__":
    main()
