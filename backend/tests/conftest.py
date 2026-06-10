"""Shared fixtures. Integration tests against the app's Postgres (docker compose
up -d db). Each fixture creates and tears down its own throwaway data, so the
tests don't depend on the importer having run."""

import pytest
from fastapi.testclient import TestClient

from app.db.database import connect
from app.main import app
from app.services.users import create_user

TEST_USER = "pytest_user"
TEST_PW = "pytest_pw_123"

# Throwaway symbol with known bars so the market tests don't need real data.
SEED_SYMBOL = "TST"
SEED_BARS = [
    # ts,           open,  high,  low,   close, volume
    ("2026-01-02", 100.0, 110.0, 95.0, 105.0, 1000),
    ("2026-01-05", 105.0, 120.0, 100.0, 115.0, 2000),
    ("2026-01-06", 115.0, 118.0, 108.0, 110.0, 1500),
]


# The context manager runs the app lifespan (opens the pool). Session-scoped
# because the pool can't be reopened once closed.
@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db():
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()


@pytest.fixture
def fresh_cookies(client):
    client.cookies.clear()
    yield
    client.cookies.clear()


@pytest.fixture
def test_user(db):
    db.execute("DELETE FROM users WHERE username = %s", (TEST_USER,))
    create_user(db, TEST_USER, TEST_PW)
    yield {"username": TEST_USER, "password": TEST_PW}
    db.execute("DELETE FROM users WHERE username = %s", (TEST_USER,))  # sessions cascade


@pytest.fixture
def auth_client(client, test_user):
    client.cookies.clear()
    resp = client.post("/api/auth/login", json=test_user)
    assert resp.status_code == 200
    yield client
    client.post("/api/auth/logout")
    client.cookies.clear()


@pytest.fixture
def seeded_symbol(db):
    db.execute("DELETE FROM prices WHERE symbol = %s", (SEED_SYMBOL,))
    db.execute("DELETE FROM symbols WHERE symbol = %s", (SEED_SYMBOL,))
    db.execute(
        "INSERT INTO symbols (symbol, name, is_default) VALUES (%s, %s, FALSE)",
        (SEED_SYMBOL, "Test Corp"),
    )
    with db.cursor() as cur:
        cur.executemany(
            "INSERT INTO prices (symbol, ts, open, high, low, close, volume)"
            " VALUES (%s, %s, %s, %s, %s, %s, %s)",
            [(SEED_SYMBOL, *bar) for bar in SEED_BARS],
        )
    yield SEED_SYMBOL
    db.execute("DELETE FROM prices WHERE symbol = %s", (SEED_SYMBOL,))
    db.execute("DELETE FROM symbols WHERE symbol = %s", (SEED_SYMBOL,))
