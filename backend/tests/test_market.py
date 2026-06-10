"""Market endpoints. Expected numbers come from SEED_BARS in conftest."""


def test_symbols_lists_universe(auth_client):
    resp = auth_client.get("/api/symbols")
    assert resp.status_code == 200
    symbols = resp.json()
    assert any(s["symbol"] == "AAPL" and s["is_default"] for s in symbols)


def test_series_happy_path(auth_client, seeded_symbol):
    resp = auth_client.get(
        "/api/series",
        params={"symbol": seeded_symbol, "from": "2026-01-01", "to": "2026-01-31"},
    )
    assert resp.status_code == 200
    body = resp.json()

    assert len(body["series"]) == 3
    assert body["series"][0]["ts"] == "2026-01-02"  # DATE serialised back to a string

    summary = body["summary"]
    assert summary["start_close"] == 105.0
    assert summary["end_close"] == 110.0
    assert summary["high"] == 120.0
    assert summary["low"] == 95.0
    assert summary["cumulative_volume"] == 4500
    assert summary["count"] == 3
    assert round(summary["pct_change"], 4) == round((110.0 - 105.0) / 105.0 * 100, 4)


def test_series_unknown_symbol_404(auth_client):
    assert auth_client.get("/api/series", params={"symbol": "ZZZZ"}).status_code == 404


def test_series_bad_date_400(auth_client):
    resp = auth_client.get("/api/series", params={"symbol": "AAPL", "from": "not-a-date"})
    assert resp.status_code == 400


def test_series_empty_window_is_200_with_null_summary(auth_client, seeded_symbol):
    resp = auth_client.get(
        "/api/series",
        params={"symbol": seeded_symbol, "from": "1990-01-01", "to": "1990-01-05"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["series"] == []
    assert body["summary"] is None


def test_series_requires_auth(client, fresh_cookies):
    assert client.get("/api/series", params={"symbol": "AAPL"}).status_code == 401
