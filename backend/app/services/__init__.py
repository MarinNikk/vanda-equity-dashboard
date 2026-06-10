"""Service layer: business logic and the only place that runs SQL.

Routers call into these functions; the functions take a DB connection and return
plain data / Pydantic models. Keeping all queries here means the database engine
is swappable from one place (see app/db/database.py).
"""
