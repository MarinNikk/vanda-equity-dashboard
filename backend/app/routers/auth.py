from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.core.config import settings
from app.dependencies import COOKIE_NAME, get_current_user, get_db
from app.models.auth import LoginRequest, UserOut
from app.services import auth as auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        max_age=settings.session_ttl_days * 24 * 3600,
        path="/",
    )


@router.post("/login", response_model=UserOut)
def login(body: LoginRequest, response: Response, conn=Depends(get_db)):
    user = auth_service.authenticate_user(conn, body.username, body.password)
    if user is None:
        # generic message so you can't probe for valid usernames
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password"
        )

    token = auth_service.create_session(conn, user["id"])
    _set_session_cookie(response, token)
    return {"username": user["username"]}


@router.post("/logout")
def logout(request: Request, response: Response, conn=Depends(get_db)):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        auth_service.delete_session(conn, token)
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(user: dict = Depends(get_current_user)):
    return {"username": user["username"]}
