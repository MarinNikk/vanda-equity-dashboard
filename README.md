# Vanda Equity Analytics Dashboard

A login-gated dashboard showing daily price and volume for a few stock tickers,
with summary stats. An importer pulls the data from Twelvedata into a local
Postgres; the app only ever reads from that store, so the API key stays
server-side and we never hit the rate limit while serving a request.

**Live demo:** https://vanda-equity-dashboard.vercel.app (`Marin` / `marin123`)

## Stack

| Layer        | Choice                             |
| ------------ | ---------------------------------- |
| Backend      | Python + FastAPI                   |
| Store        | PostgreSQL (psycopg 3, via Docker) |
| Frontend     | React + Vite + TypeScript          |
| Server state | TanStack Query                     |
| Charts       | Highcharts Stock                   |
| Auth         | httpOnly session cookie            |
| Importer     | Standalone Python script           |

Versions: Python 3.12, Node 18 (Vite v5), PostgreSQL 16.

## Project layout

```
vanda-equity-dashboard/
├── backend/
│   ├── Dockerfile          # API image (also used by the seed service)
│   └── app/
│       ├── main.py            # app factory: CORS, lifespan, routers
│       ├── dependencies.py    # get_db, get_current_user
│       ├── core/              # config + security helpers
│       ├── db/                # connection pool + schema.sql
│       ├── models/            # Pydantic schemas
│       ├── routers/           # HTTP endpoints
│       ├── services/          # logic + all SQL
│       ├── external/          # Twelvedata client
│       ├── importer.py        # CLI: import OHLCV
│       └── create_user.py     # CLI: create a login
├── frontend/                  # React + Vite + TS SPA
│   ├── Dockerfile             # build with Vite, serve with nginx
│   └── nginx.conf             # serves the SPA, proxies /api to the backend
├── docker-compose.yml         # db + backend + frontend + seed
└── README.md
```

Backend is layered: routers do HTTP, services hold the logic and own every SQL
query, models are the shapes. A request goes router → service → db. All the SQL
lives in `services/` and `db/`, so swapping the database engine only touches
those.

## Running it

Two ways: the whole stack in Docker with one command, or each service on its own.

> Commands are PowerShell (Windows). On macOS/Linux, use `cp` instead of `copy`
> and `source .venv/bin/activate` instead of the `Activate.ps1` line.

### Option A: Docker (one command)

From the repo root, with Docker Desktop running:

```powershell
copy backend\.env.example backend\.env   # then add your Twelvedata key
docker compose up --build
```

Open http://localhost:8080 and log in with `Marin` / `marin123`.

That brings up four containers: Postgres (`db`), the API (`backend`), the SPA on
nginx (`frontend`, port 8080), and a one-off `seed` that creates the demo user,
runs the importer, and exits. nginx also proxies `/api` to the backend, so the
browser sees one origin — the cookie stays first-party and there's no CORS.

The key is only used by the importer; without one the stack still comes up, the
dashboard's just empty. `docker compose down -v` wipes the database too.

### Option B: run the services directly

```powershell
docker compose up -d db          # just Postgres
```

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env           # add your Twelvedata key
python -m app.importer           # applies the schema + imports data
python -m app.create_user Marin marin123
uvicorn app.main:app --reload
```

API on http://localhost:8000 (`/api/health` to check). It applies the schema on
startup.

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Runs on http://localhost:5173 and proxies `/api` to the backend.

### Importer

From `backend/` with the venv active and the key set:

```powershell
python -m app.importer                # incremental import of all tickers
python -m app.importer AAPL MSFT      # just these
python -m app.importer --full-refresh # ignore watermarks, refetch
python -m app.importer --sleep 2      # pause between symbols (rate limit)
```

Applies the schema if needed, so it works on a fresh clone.

### Tests

```powershell
cd backend
pip install -r requirements-dev.txt
python -m pytest
```

Covers the auth gate and login/logout, the market endpoints (including 404-vs-empty
and bad-date), the summary calculation, the response parser, and the importer's
upsert + watermark. Integration tests create and clean up their own user/symbol.

### Deploying

Live on Vercel (SPA), Neon (Postgres), and Render (API), with the importer as a
nightly GitHub Action. Config is in the repo: `frontend/vercel.json`,
`render.yaml`, `.github/workflows/importer.yml`. The local `/api` proxy carries
over as a Vercel rewrite, so the cookie stays first-party in prod too — the only
change is `COOKIE_SECURE=true`.

## Environment variables

| Variable             | Used by  | Description                                   |
| -------------------- | -------- | --------------------------------------------- |
| `TWELVEDATA_API_KEY` | importer | Twelvedata API key. Server-side only.         |
| `DATABASE_URL`       | backend  | Postgres connection string.                   |
| `CORS_ORIGINS`       | backend  | Comma-separated allowed origins.              |
| `COOKIE_SECURE`      | backend  | `true` in production (HTTPS), `false` in dev. |
| `SESSION_TTL_DAYS`   | backend  | Session length in days (default 7).           |

## Design notes

### Data

One table, `prices`, one row per `(symbol, trading day)`, composite primary key on
`(symbol, ts)`. Every query is the same shape — one symbol between two dates — and
the key is ordered exactly that way, so reads are range scans with no extra index.
That same key makes imports idempotent (the upsert below).

Postgres with psycopg 3 and plain SQL, no ORM. The dataset is tiny (~1,400 rows),
so I prototyped on SQLite and moved to Postgres as the realistic production target;
the move only touched `services/`, `db/`, and `schema.sql`. An ORM wouldn't buy
much at this query complexity. Prices are `DOUBLE PRECISION` — fine for charts, I'd
use `NUMERIC` for real money math. At much larger scale (intraday, years of data)
I'd reach for TimescaleDB and downsample on read; the schema barely changes, the
storage engine does.

### Reliability

The importer runs on a schedule, so re-running has to be safe:

- Upserts on `(symbol, ts)` — re-importing a day overwrites it instead of
  duplicating, and picks up late revisions. Tested.
- Incremental: it reads each symbol's latest stored date (the watermark) and only
  fetches from there, so a routine run is ~one row per symbol.
- Each symbol runs in its own transaction, so one bad ticker can't block the rest.
  The run exits non-zero if any symbol failed.
- Errors vs empty: a bad key or unknown symbol raises; an empty window just writes
  nothing. 429s retry after a wait; the parser skips bars with null OHLC.

### Performance

Mostly not doing extra work. Reads are an ordered range scan on the PK with a
single pass for the summary; `/api/series` defaults to ~6 months so a request
can't ask for everything; connections are pooled. On the client, TanStack Query
caches each `(symbol, from, to)` window so revisiting one is instant, and the
navigator zoom recomputes its summary from bars already in the browser — no
request. At scale: pre-aggregated rollups, downsampling, an HTTP cache, and
code-splitting the chart.

### API

Two read endpoints, both behind auth:

- `GET /api/symbols` — the ticker list, default flagged.
- `GET /api/series?symbol=&from=&to=` — bars and summary in one response.

Bars and summary come back together because the dashboard always needs both and it
keeps them describing the same window. The summary is computed server-side for one
source of truth. Status codes carry meaning: unknown symbol → 404; valid symbol,
no rows → 200 with an empty series and null summary; bad date → 400; no/expired
session → 401. The frontend keys its empty and error states off these.

### Auth

Server-side sessions behind an httpOnly cookie. On login the backend checks the
bcrypt password, generates a random token, stores its SHA-256 hash in a `sessions`
table, and sets the raw token as an httpOnly, `SameSite=Lax` (`Secure` in prod)
cookie. Every protected route runs through `get_current_user`, which hashes the
cookie, looks up the session, checks expiry, and returns the user or a 401.

Why this shape:

- httpOnly keeps the token out of JS (XSS can't read it); SameSite=Lax helps CSRF.
- Storing only the hash means a leaked DB can't be replayed as live sessions.
- Server sessions cost a lookup per request but are revocable — logout deletes the
  row and the session is dead immediately. A JWT wouldn't give me that for free.

The SPA never handles a token. In dev Vite proxies `/api` so the browser sees one
origin; Docker (nginx) and the cloud (Vercel rewrite) do the same. Different
origins would need `SameSite=None; Secure` and credentialed CORS.

### Frontend

TanStack Query owns the server state: `symbols` and `auth/me` are basically static
(`staleTime: Infinity`); `series` is cached per window with a 5-minute staleTime;
the previous window stays on screen while a new one loads, so switching ticker or
range shows an "Updating…" hint instead of a spinner. One typed `apiFetch`, one
`hooks.ts`, shared `types.ts`, and a single `StatusView` for loading/error/empty.

Charts are Highcharts Stock — purpose-built for financial time-series, so
candlestick + volume pane + navigator + crosshairs come for free. Dragging the
navigator recomputes the summary client-side; that formula
(`frontend/src/lib/summary.ts`) mirrors the server's `build_summary` and has to
stay in sync. Highcharts renders SVG and can't read CSS variables, so the theme
colors are mirrored into a `useChartTheme` hook.

Caveat: Highcharts is free for personal/evaluation use but needs a license for
production — for a real deployment that's a cost to weigh (Recharts or a small
candlestick lib otherwise). The Highstock bundle is also ~600 kB, so code-splitting
the chart is the first optimization.

### Operations

- The importer runs on a schedule (cron / Task Scheduler / GitHub Actions). Being
  incremental and idempotent, a missed or repeated run is harmless, and it exits
  non-zero so a scheduler can alert.
- The local store exists to respect Twelvedata's free tier (~8 req/min, 800/day):
  the DB is the cache, the app never calls out at request time.
- Schema is applied on startup, fine while it's fixed; I'd move to Alembic once it
  starts changing. Config and secrets come from env vars and a gitignored `.env`.
- `/api/health` is a liveness check. Expired sessions are deleted on access.

## Trade-offs

- Raw SQL, not an ORM: explicit at this complexity, but manual row mapping and no
  auto-migrations.
- Autocommit for single-statement writes; the importer's per-symbol batch uses an
  explicit transaction where atomicity matters.
- Fixed ticker list seeded in `schema.sql`, no admin UI.
- Daily data only.
- Prices as `DOUBLE PRECISION`.
- Username/password with CLI-created accounts — no self-registration, rate
  limiting, or refresh tokens yet.
- The client's sub-range summary duplicates `build_summary`, so the two must stay
  in sync.

## With more time

- Alembic migrations instead of schema-on-startup.
- Code-split the chart.
- More tests: broader backend coverage, frontend (Vitest + RTL), an e2e path.
- Harder auth: self-registration, rate limiting, password rules, session cleanup.
- Observability: structured logs, metrics, error tracking.
- More data: split/dividend adjustment, more tickers, optional intraday.
