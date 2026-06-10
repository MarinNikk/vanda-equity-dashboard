import type { SymbolInfo } from '../api/types'

// Range presets in days. "All" just asks for a wide window; the server returns
// whatever history it holds.
export const RANGE_PRESETS: { label: string; days: number }[] = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: 1825 },
]

interface Props {
  symbols: SymbolInfo[]
  selected: string | null
  onSelect: (symbol: string) => void
  rangeDays: number
  onRangeChange: (days: number) => void
}

export default function Controls({ symbols, selected, onSelect, rangeDays, onRangeChange }: Props) {
  return (
    <div className="controls card">
      <div className="control-group">
        <span className="control-label">Ticker</span>
        <div className="ticker-row">
          {symbols.map((s) => (
            <button
              key={s.symbol}
              className={`ticker ${s.symbol === selected ? 'ticker-active' : ''}`}
              onClick={() => onSelect(s.symbol)}
            >
              <span className="ticker-symbol">{s.symbol}</span>
              {s.name && <span className="ticker-name">{s.name}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="control-group">
        <span className="control-label">Range</span>
        <div className="segmented">
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.days}
              className={`seg ${p.days === rangeDays ? 'seg-active' : ''}`}
              onClick={() => onRangeChange(p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
