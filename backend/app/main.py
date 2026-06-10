from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import init_db, pool
from app.routers import auth, health, market


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool.open()
    pool.wait()  # fail fast if Postgres isn't reachable
    init_db()
    yield
    pool.close()


def create_app() -> FastAPI:
    app = FastAPI(title="Vanda Equity Analytics API", lifespan=lifespan)

    # credentials=True means we can't use "*" for origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(market.router)
    return app


app = create_app()
