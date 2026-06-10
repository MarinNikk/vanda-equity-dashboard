from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies import get_current_user, get_db
from app.models.market import SeriesResponse, SymbolOut
from app.services import market as market_service

router = APIRouter(prefix="/api", tags=["market"])

DEFAULT_RANGE_DAYS = 180


def _parse_date(value: str, field: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {field} date '{value}'; expected YYYY-MM-DD",
        )


@router.get("/symbols", response_model=list[SymbolOut])
def list_symbols(conn=Depends(get_db), user: dict = Depends(get_current_user)):
    return market_service.list_symbols(conn)


@router.get("/series", response_model=SeriesResponse)
def get_series(
    symbol: str = Query(..., description="Ticker symbol, e.g. AAPL"),
    from_: str | None = Query(None, alias="from", description="Start date YYYY-MM-DD (inclusive)"),
    to: str | None = Query(None, alias="to", description="End date YYYY-MM-DD (inclusive)"),
    conn=Depends(get_db),
    user: dict = Depends(get_current_user),
):
    symbol = symbol.upper()

    to_date = _parse_date(to, "to") if to else date.today()
    from_date = (
        _parse_date(from_, "from") if from_ else (to_date - timedelta(days=DEFAULT_RANGE_DAYS))
    )
    if from_date > to_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="'from' date must not be after 'to' date",
        )

    # unknown symbol = 404; known symbol with no rows = 200 + null summary
    if not market_service.symbol_exists(conn, symbol):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown symbol '{symbol}'"
        )

    bars = market_service.get_price_bars(conn, symbol, from_date, to_date)
    summary = market_service.build_summary(bars) if bars else None

    return SeriesResponse(
        symbol=symbol,
        from_=from_date.isoformat(),
        to=to_date.isoformat(),
        series=bars,
        summary=summary,
    )
