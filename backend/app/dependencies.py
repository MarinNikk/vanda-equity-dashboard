from fastapi import Depends, HTTPException, Request, status

from app.db.database import pool
from app.services import auth as auth_service

COOKIE_NAME = "vanda_session"


def get_db():
    with pool.connection() as conn:
        yield conn


def get_current_user(request: Request, conn=Depends(get_db)) -> dict:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user = auth_service.resolve_session(conn, token)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    return user
