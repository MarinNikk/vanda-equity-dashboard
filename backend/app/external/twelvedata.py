"""Twelvedata client. The only place that talks to the provider; returns typed Bars."""

import time
from dataclasses import dataclass

import httpx

BASE_URL = "https://api.twelvedata.com/time_series"


class TwelvedataError(Exception):
    """An upstream failure (bad key, unknown symbol, rate limit) — distinct from
    an empty result, which is not an error."""

    def __init__(self, message: str, code: int | None = None):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class Bar:
    ts: str  # 'YYYY-MM-DD'
    open: float
    high: float
    low: float
    close: float
    volume: int


def _parse_bars(values: list[dict]) -> list[Bar]:
    # Fields arrive as strings and can be null; skip any bar missing OHLC.
    bars: list[Bar] = []
    for v in values:
        o, h, low, c = v.get("open"), v.get("high"), v.get("low"), v.get("close")
        if any(x in (None, "") for x in (o, h, low, c)):
            continue
        try:
            vol = v.get("volume")
            bars.append(
                Bar(
                    ts=v["datetime"][:10],
                    open=float(o),
                    high=float(h),
                    low=float(low),
                    close=float(c),
                    volume=int(float(vol)) if vol not in (None, "") else 0,
                )
            )
        except (KeyError, ValueError, TypeError):
            continue  # one bad row shouldn't sink the import
    return bars


def fetch_daily(
    symbol: str,
    api_key: str,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
    outputsize: int = 5000,
    timeout: float = 30.0,
    max_retries: int = 3,
    retry_wait: float = 15.0,
) -> list[Bar]:
    """Daily bars for one symbol, oldest-first. Raises TwelvedataError on an upstream
    failure, returns [] for a genuine no-data window, retries only on rate limiting."""
    params: dict[str, str | int] = {
        "symbol": symbol,
        "interval": "1day",
        "apikey": api_key,
        "outputsize": outputsize,
        "order": "ASC",
    }
    if start_date:
        params["start_date"] = start_date
    if end_date:
        params["end_date"] = end_date

    for attempt in range(max_retries + 1):
        resp = httpx.get(BASE_URL, params=params, timeout=timeout)

        # Rate limiting arrives as either HTTP 429 or a 200 with code 429 in the body.
        rate_limited = resp.status_code == 429
        payload = {}
        if not rate_limited:
            resp.raise_for_status()
            payload = resp.json()
            if payload.get("status") == "error":
                code = payload.get("code")
                if code == 429:
                    rate_limited = True
                else:
                    raise TwelvedataError(payload.get("message", "unknown error"), code=code)

        if rate_limited:
            if attempt < max_retries:
                time.sleep(retry_wait)
                continue
            raise TwelvedataError("rate limited; retries exhausted", code=429)

        return _parse_bars(payload.get("values") or [])

    raise TwelvedataError("exhausted retries", code=429)
