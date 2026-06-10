import type { Bar, Summary } from '../api/types'

// Mirror of the backend build_summary (app/services/market.py), used to re-derive
// stats for a navigator-selected sub-range from already-fetched bars (no extra
// round-trip). Keep in lockstep with the server formula.
export function computeSummary(bars: Bar[]): Summary | null {
  if (bars.length === 0) return null

  const first = bars[0]
  const last = bars[bars.length - 1]

  let high = -Infinity
  let low = Infinity
  let cumulativeVolume = 0
  for (const b of bars) {
    if (b.high > high) high = b.high
    if (b.low < low) low = b.low
    cumulativeVolume += b.volume
  }

  const pctChange = first.close !== 0 ? ((last.close - first.close) / first.close) * 100 : 0

  return {
    start_date: first.ts,
    end_date: last.ts,
    start_close: first.close,
    end_close: last.close,
    pct_change: pctChange,
    high,
    low,
    cumulative_volume: cumulativeVolume,
    count: bars.length,
  }
}
