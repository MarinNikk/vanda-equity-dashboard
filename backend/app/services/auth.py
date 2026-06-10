from datetime import datetime, timedelta, timezone

from app.core import security
from app.core.config import settings


def authenticate_user(conn, username: str, password: str) -> dict | None:
    row = conn.execute(
        "SELECT id, username, password_hash FROM users WHERE username = %s",
        (username,),
    ).fetchone()
    if row is None or not security.verify_password(password, row["password_hash"]):
        return None
    return {"id": row["id"], "username": row["username"]}


def create_session(conn, user_id: int) -> str:
    token = security.generate_session_token()
    expires = datetime.now(timezone.utc) + timedelta(days=settings.session_ttl_days)
    conn.execute(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (%s, %s, %s)",
        (security.hash_token(token), user_id, expires),
    )
    return token


def resolve_session(conn, token: str) -> dict | None:
    token_hash = security.hash_token(token)
    row = conn.execute(
        """
        SELECT u.id, u.username, s.expires_at
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = %s
        """,
        (token_hash,),
    ).fetchone()

    if row is None:
        return None

    if row["expires_at"] < datetime.now(timezone.utc):
        conn.execute("DELETE FROM sessions WHERE token_hash = %s", (token_hash,))  # expire on access
        return None

    return {"id": row["id"], "username": row["username"]}


def delete_session(conn, token: str) -> None:
    conn.execute(
        "DELETE FROM sessions WHERE token_hash = %s",
        (security.hash_token(token),),
    )
