import type { Summary } from '../api/types'

const usd = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const compact = (v: number) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 }).format(v)
const shortDate = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

interface Props {
  symbol: string
  name?: string | null
  summary: Summary
  // True when the figures reflect a navigator-selected sub-range rather than the
  // full requested window.
  selected?: boolean
}

export default function SummaryPanel({ symbol, name, summary, selected }: Props) {
  const up = summary.pct_change >= 0
  const dir = up ? 'up' : 'down'
  const delta = summary.end_close - summary.start_close

  return (
    <section className="summary">
      <div className="summary-hero card">
        <div className="hero-id">
          <span className="hero-symbol">{symbol}</span>
          {name && <span className="hero-name muted">{name}</span>}
          <span className="hero-period muted">
            {shortDate(summary.start_date)} – {shortDate(summary.end_date)}
          </span>
          {selected && <span className="hero-tag">Selected</span>}
        </div>
        <div className="hero-price">
          <span className="hero-close num">{usd(summary.end_close)}</span>
          <span className={`pill pill-${dir}`}>
            <span className="pill-arrow">{up ? '▲' : '▼'}</span>
            <span className="num">
              {up ? '+' : ''}
              {usd(delta)}
            </span>
            <span className="num">
              ({up ? '+' : ''}
              {summary.pct_change.toFixed(2)}%)
            </span>
          </span>
        </div>
      </div>

      <div className="kpi-grid">
        <Kpi label="Period high" value={usd(summary.high)} />
        <Kpi label="Period low" value={usd(summary.low)} />
        <Kpi label="Period start" value={usd(summary.start_close)} />
        <Kpi
          label="Cumulative volume"
          value={compact(summary.cumulative_volume)}
          sub={`${summary.count} trading days`}
        />
      </div>
    </section>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="kpi card">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value num">{value}</span>
      {sub && <span className="kpi-sub muted">{sub}</span>}
    </div>
  )
}
