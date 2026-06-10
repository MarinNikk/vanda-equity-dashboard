from pydantic import BaseModel, ConfigDict, Field


class SymbolOut(BaseModel):
    symbol: str
    name: str | None
    is_default: bool


class Bar(BaseModel):
    ts: str
    open: float
    high: float
    low: float
    close: float
    volume: int


class Summary(BaseModel):
    start_date: str
    end_date: str
    start_close: float
    end_close: float
    pct_change: float  # e.g. 12.34 == +12.34%
    high: float
    low: float
    cumulative_volume: int
    count: int


class SeriesResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    symbol: str
    from_: str = Field(alias="from")  # `from` is a reserved word
    to: str
    series: list[Bar]
    summary: Summary | None  # null = valid symbol, no data in range
