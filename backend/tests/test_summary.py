"""Pure unit tests for build_summary (the formula the frontend mirrors)."""

from app.models.market import Bar
from app.services.market import build_summary


def test_build_summary_basic():
    bars = [
        Bar(ts="2026-01-02", open=100, high=110, low=95, close=105, volume=1000),
        Bar(ts="2026-01-05", open=105, high=120, low=100, close=115, volume=2000),
        Bar(ts="2026-01-06", open=115, high=118, low=108, close=110, volume=1500),
    ]
    s = build_summary(bars)

    assert s.start_date == "2026-01-02"
    assert s.end_date == "2026-01-06"
    assert s.start_close == 105
    assert s.end_close == 110
    assert s.high == 120          # max of highs
    assert s.low == 95            # min of lows
    assert s.cumulative_volume == 4500
    assert s.count == 3
    assert round(s.pct_change, 4) == round((110 - 105) / 105 * 100, 4)


def test_build_summary_single_bar_is_flat():
    bars = [Bar(ts="2026-01-02", open=100, high=110, low=95, close=105, volume=1000)]
    s = build_summary(bars)
    assert s.count == 1
    assert s.start_close == s.end_close == 105
    assert s.pct_change == 0.0
