-- Equity analytics store (PostgreSQL). Every statement is idempotent so this can
-- be applied on every startup.

-- One row per (symbol, trading day). The composite PK gives idempotent UPSERTs
-- and fast ordered range scans.
CREATE TABLE IF NOT EXISTS prices (
    symbol  TEXT             NOT NULL,
    ts      DATE             NOT NULL,
    open    DOUBLE PRECISION NOT NULL,
    high    DOUBLE PRECISION NOT NULL,
    low     DOUBLE PRECISION NOT NULL,
    close   DOUBLE PRECISION NOT NULL,
    volume  BIGINT           NOT NULL,
    PRIMARY KEY (symbol, ts)
);

-- The fixed universe of tickers the dashboard offers.
CREATE TABLE IF NOT EXISTS symbols (
    symbol     TEXT PRIMARY KEY,
    name       TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE   -- one row should be TRUE
);

CREATE TABLE IF NOT EXISTS users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Active sessions. We store the SHA-256 hash of the token, never the token
-- itself, so a DB dump can't be replayed as a live session.
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Seed the ticker universe. ON CONFLICT DO NOTHING keeps this safe to re-run.
INSERT INTO symbols (symbol, name, is_default) VALUES
    ('AAPL', 'Apple Inc.',            TRUE),
    ('MSFT', 'Microsoft Corporation', FALSE),
    ('NVDA', 'NVIDIA Corporation',    FALSE),
    ('TSLA', 'Tesla, Inc.',           FALSE),
    ('AMZN', 'Amazon.com, Inc.',      FALSE)
ON CONFLICT (symbol) DO NOTHING;
