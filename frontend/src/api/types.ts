// Mirrors the backend response shapes.

export interface User {
  username: string
}

export interface SymbolInfo {
  symbol: string
  name: string | null
  is_default: boolean
}

export interface Bar {
  ts: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Summary {
  start_date: string
  end_date: string
  start_close: number
  end_close: number
  pct_change: number
  high: number
  low: number
  cumulative_volume: number
  count: number
}

export interface SeriesResponse {
  symbol: string
  from: string
  to: string
  series: Bar[]
  summary: Summary | null
}
