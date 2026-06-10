# pool backs the API; connect() is a standalone connection for the CLI scripts.
# Both autocommit + dict rows, so row["close"] works.

import re
from pathlib import Path

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.core.config import settings

SCHEMA_PATH = Path(__file__).parent / "schema.sql"

# open=False so importing this module doesn't touch the DB; main.py opens/closes it.
pool = ConnectionPool(
    conninfo=settings.database_url,
    min_size=1,
    max_size=10,
    open=False,
    kwargs={"autocommit": True, "row_factory": dict_row},
)


def connect() -> psycopg.Connection:
    return psycopg.connect(settings.database_url, autocommit=True, row_factory=dict_row)


def init_db() -> None:
    """Apply the schema. Idempotent — safe to call on every startup."""
    sql = SCHEMA_PATH.read_text(encoding="utf-8")
    # Strip `--` comments before splitting on ';' (a comment may contain one);
    # psycopg sends one statement per execute().
    sql = re.sub(r"--[^\n]*", "", sql)
    statements = [s.strip() for s in sql.split(";") if s.strip()]
    with connect() as conn:
        for statement in statements:
            conn.execute(statement)
