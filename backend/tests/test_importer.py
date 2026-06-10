"""Importer data access: idempotent UPSERT and incremental watermark."""

from datetime import date

import pytest

from app.external.twelvedata import Bar
from app.services.ingest import get_watermark, upsert_bars

ISYM = "ITST"  # throwaway symbol for importer tests


def _count(db, symbol):
    return db.execute(
        "SELECT count(*) AS n FROM prices WHERE symbol = %s", (symbol,)
    ).fetchone()["n"]


@pytest.fixture
def isym(db):
    db.execute("DELETE FROM prices WHERE symbol = %s", (ISYM,))
    yield ISYM
    db.execute("DELETE FROM prices WHERE symbol = %s", (ISYM,))


def _bars():
    return [
        Bar(ts="2026-02-02", open=10, high=12, low=9, close=11, volume=100),
        Bar(ts="2026-02-03", open=11, high=13, low=10, close=12, volume=200),
        Bar(ts="2026-02-04", open=12, high=14, low=11, close=13, volume=300),
    ]


def test_upsert_is_idempotent(db, isym):
    upsert_bars(db, isym, _bars())
    assert _count(db, isym) == 3

    # A second identical run must not duplicate rows.
    upsert_bars(db, isym, _bars())
    assert _count(db, isym) == 3


def test_upsert_updates_in_place(db, isym):
    upsert_bars(db, isym, [Bar(ts="2026-02-02", open=10, high=12, low=9, close=11, volume=100)])
    # Re-import the same day with a revised close — should overwrite, not insert.
    upsert_bars(db, isym, [Bar(ts="2026-02-02", open=10, high=12, low=9, close=99, volume=100)])

    assert _count(db, isym) == 1
    row = db.execute(
        "SELECT close FROM prices WHERE symbol = %s AND ts = %s", (isym, "2026-02-02")
    ).fetchone()
    assert row["close"] == 99


def test_watermark_tracks_latest_day(db, isym):
    assert get_watermark(db, isym) is None  # nothing stored yet

    upsert_bars(db, isym, _bars())
    assert get_watermark(db, isym) == date(2026, 2, 4)
