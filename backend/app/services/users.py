from psycopg.errors import UniqueViolation

from app.core import security


class UserExistsError(Exception):
    pass


def create_user(conn, username: str, password: str) -> None:
    try:
        conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (%s, %s)",
            (username, security.hash_password(password)),
        )
    except UniqueViolation as exc:
        raise UserExistsError(username) from exc
