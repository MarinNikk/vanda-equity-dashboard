"""Unit tests for the Twelvedata response parser — string fields, nulls, and
the odd bad row are exactly what the provider sends, so pin the behaviour down."""

from app.external.twelvedata import _parse_bars


def test_parses_string_fields_to_numbers():
    bars = _parse_bars(
        [{"datetime": "2026-01-02", "open": "100.5", "high": "110",
          "low": "95.25", "close": "105", "volume": "1000"}]
    )
    assert len(bars) == 1
    b = bars[0]
    assert b.ts == "2026-01-02"
    assert (b.open, b.high, b.low, b.close) == (100.5, 110.0, 95.25, 105.0)
    assert b.volume == 1000


def test_truncates_datetime_to_date():
    bars = _parse_bars(
        [{"datetime": "2026-01-02 15:30:00", "open": "1", "high": "1",
          "low": "1", "close": "1", "volume": "1"}]
    )
    assert bars[0].ts == "2026-01-02"


def test_skips_bars_missing_ohlc():
    values = [
        {"datetime": "2026-01-02", "open": None, "high": "1", "low": "1", "close": "1", "volume": "1"},
        {"datetime": "2026-01-03", "open": "1", "high": "1", "low": "1", "close": "", "volume": "1"},
        {"datetime": "2026-01-04", "open": "1", "high": "1", "low": "1", "close": "1", "volume": "1"},
    ]
    bars = _parse_bars(values)
    assert [b.ts for b in bars] == ["2026-01-04"]


def test_missing_volume_defaults_to_zero():
    bars = _parse_bars(
        [{"datetime": "2026-01-02", "open": "1", "high": "1", "low": "1", "close": "1", "volume": None}]
    )
    assert bars[0].volume == 0


def test_one_unparseable_row_does_not_sink_the_rest():
    values = [
        {"datetime": "2026-01-02", "open": "x", "high": "1", "low": "1", "close": "1", "volume": "1"},
        {"datetime": "2026-01-03", "open": "2", "high": "2", "low": "2", "close": "2", "volume": "2"},
    ]
    bars = _parse_bars(values)
    assert [b.ts for b in bars] == ["2026-01-03"]


def test_empty_input():
    assert _parse_bars([]) == []
