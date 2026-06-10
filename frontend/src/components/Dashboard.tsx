import { useEffect, useMemo, useState } from 'react'

import { ApiError } from '../api/client'
import { useLogout, useSeries, useSymbols } from '../api/hooks'
import { computeSummary } from '../lib/summary'
import Controls from './Controls'
import MarketChart, { type SelectedRange } from './MarketChart'
import StatusView from './StatusView'
import SummaryPanel from './SummaryPanel'
import ThemeToggle from './ThemeToggle'

const toMs = (ts: string) => Date.parse(ts + 'T00:00:00Z')

const toISO = (d: Date) => d.toISOString().slice(0, 10)
const today = () => toISO(new Date())
const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toISO(d)
}

export default function Dashboard({ username }: { username: string }) {
  const symbolsQ = useSymbols()
  const logout = useLogout()

  const [symbol, setSymbol] = useState<string | null>(null)
  const [rangeDays, setRangeDays] = useState(180)
  // The sub-window selected via the chart navigator; null = full server window.
  const [selected, setSelected] = useState<SelectedRange | null>(null)

  // Pick the default ticker once the universe loads.
  useEffect(() => {
    if (!symbol && symbolsQ.data) {
      const def = symbolsQ.data.find((s) => s.is_default) ?? symbolsQ.data[0]
      if (def) setSymbol(def.symbol)
    }
  }, [symbol, symbolsQ.data])

  // A new fetch (different ticker or range) invalidates any navigator selection.
  useEffect(() => {
    setSelected(null)
  }, [symbol, rangeDays])

  const from = daysAgo(rangeDays)
  const to = today()
  const seriesQ = useSeries(symbol, from, to)
  const activeName = symbolsQ.data?.find((s) => s.symbol === symbol)?.name ?? null

  // Full window → server summary; a navigator sub-range → re-derived client-side.
  const shownSummary = useMemo(() => {
    if (!seriesQ.data) return null
    if (!selected) return seriesQ.data.summary
    const inRange = seriesQ.data.series.filter((b) => {
      const ms = toMs(b.ts)
      return ms >= selected.min && ms <= selected.max
    })
    return computeSummary(inRange) ?? seriesQ.data.summary
  }, [seriesQ.data, selected])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            ◆
          </span>
          <span className="brand-text">Vanda</span>
          <span className="brand-sub muted">Equity Analytics</span>
        </div>
        <div className="topbar-right">
          <ThemeToggle />
          <div className="user-chip">
            <span className="user-avatar" aria-hidden>
              {username.slice(0, 1).toUpperCase()}
            </span>
            <span className="user-name">{username}</span>
          </div>
          <button className="btn-secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>
            Sign out
          </button>
        </div>
      </header>

      <main className="content">
        {symbolsQ.isPending && <StatusView kind="loading" />}
        {symbolsQ.isError && (
          <StatusView
            kind="error"
            message={(symbolsQ.error as ApiError)?.message ?? 'Failed to load tickers.'}
            onRetry={() => symbolsQ.refetch()}
          />
        )}

        {symbolsQ.data && (
          <>
            <Controls
              symbols={symbolsQ.data}
              selected={symbol}
              onSelect={setSymbol}
              rangeDays={rangeDays}
              onRangeChange={setRangeDays}
            />

            {/* Fixed-height row so the updating indicator doesn't shift the layout. */}
            <div className="updating-row">
              {seriesQ.isFetching && !seriesQ.isPending && (
                <span className="updating muted">
                  <span className="dot-pulse" /> Updating…
                </span>
              )}
            </div>

            <section className="data-area">
              {seriesQ.isPending && <StatusView kind="loading" />}

              {seriesQ.isError && (
                <StatusView
                  kind="error"
                  message={(seriesQ.error as ApiError)?.message ?? 'Request failed.'}
                  onRetry={() => seriesQ.refetch()}
                />
              )}

              {seriesQ.isSuccess && seriesQ.data.series.length === 0 && (
                <StatusView kind="empty" />
              )}

              {seriesQ.isSuccess && seriesQ.data.series.length > 0 && shownSummary && (
                <>
                  <SummaryPanel
                    symbol={seriesQ.data.symbol}
                    name={activeName}
                    summary={shownSummary}
                    selected={selected !== null}
                  />
                  <MarketChart
                    symbol={seriesQ.data.symbol}
                    bars={seriesQ.data.series}
                    onRangeChange={setSelected}
                  />
                </>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
