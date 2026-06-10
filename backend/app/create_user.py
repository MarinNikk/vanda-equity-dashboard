"""CLI to create an application user.

    python -m app.create_user alice           # prompts for the password
    python -m app.create_user alice s3cret     # password inline (dev convenience)
"""

import argparse
import getpass
import sys

from app.db.database import connect, init_db
from app.services.users import UserExistsError, create_user


def main() -> None:
    parser = argparse.ArgumentParser(description="Create an application user.")
    parser.add_argument("username")
    parser.add_argument("password", nargs="?", help="Omit to be prompted securely.")
    args = parser.parse_args()

    password = args.password or getpass.getpass("Password: ")
    if not password:
        print("Password must not be empty.", file=sys.stderr)
        raise SystemExit(1)

    init_db()
    conn = connect()
    try:
        create_user(conn, args.username, password)
    except UserExistsError:
        print(f"User '{args.username}' already exists.", file=sys.stderr)
        raise SystemExit(1)
    finally:
        conn.close()

    print(f"Created user '{args.username}'.")


if __name__ == "__main__":
    main()
