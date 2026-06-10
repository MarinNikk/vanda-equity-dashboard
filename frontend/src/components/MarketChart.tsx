import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Highcharts from 'highcharts/highstock'
import HighchartsReact from 'highcharts-react-official'

import type { Bar } from '../api/types'
import { useChartTheme } from '../theme/ThemeContext'

const DAY_MS = 86_400_000

export interface SelectedRange {
  min: number
  max: number
}

type ChartType = 'candlestick' | 'area'

const FONT =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
const MONO =
  "ui-monospace, 'SF Mono', 'Cascadia Code', 'Roboto Mono', Menlo, Consolas, monospace"

const usd = (v: number) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const compact = (v: number) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 }).format(v)

// Parse a 'YYYY-MM-DD' bar timestamp to epoch millis (UTC midnight).
const toMs = (ts: string) => Date.parse(ts + 'T00:00:00Z')

interface Props {
  symbol: string
  bars: Bar[]
  // Fired as the navigator is dragged. `null` means the full window is shown
  // (so the caller can fall back to the canonical server summary).
  onRangeChange?: (range: SelectedRange | null) => void
}

// A single Highstock chart: price pane (candle/area) over a volume pane on a
// shared datetime axis, plus the navigator minimap. The top range is driven
// server-side (see Controls), so rangeSelector/scrollbar stay off; the navigator
// is a client-side zoom aid within the loaded window.
export default function MarketChart({ symbol, bars, onRangeChange }: Props) {
  const t = useChartTheme()
  const [type, setType] = useState<ChartType>('candlestick')
  const [zoomed, setZoomed] = useState(false)

  const chartRef = useRef<HighchartsReact.RefObject>(null)
  // Held in a ref so it isn't a dep of the options memo (which would rebuild the
  // chart on every parent render and fight the navigator drag).
  const onRangeRef = useRef(onRangeChange)
  onRangeRef.current = onRangeChange
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  // Reset the visible window back to the full series.
  const resetZoom = () => chartRef.current?.chart.xAxis[0].setExtremes(undefined, undefined)

  // Highcharts keeps the last zoom extremes across data updates, so on a new
  // ticker/range snap the navigator back to the full series. Keyed on symbol +
  // date span so it fires on every genuinely new fetch.
  const dataKey = `${symbol}|${bars.length}|${bars[0]?.ts ?? ''}|${bars[bars.length - 1]?.ts ?? ''}`
  useEffect(() => {
    chartRef.current?.chart?.xAxis[0].setExtremes(undefined, undefined)
    setZoomed(false)
  }, [dataKey])

  // A theme/type change recreates the chart (see `immutable`), snapping it back
  // to the full range — so clear the zoom flag too.
  useEffect(() => {
    setZoomed(false)
  }, [type, t])

  const options = useMemo<Highcharts.Options>(() => {
    const ohlc = bars.map((b) => [toMs(b.ts), b.open, b.high, b.low, b.close])
    const closes = bars.map((b) => [toMs(b.ts), b.close])
    // Tint each volume bar by the day's direction so it reads with the candles.
    const volume = bars.map((b) => ({
      x: toMs(b.ts),
      y: b.volume,
      color: b.close >= b.open ? t.volUp : t.volDown,
    }))

    const priceSeries: Highcharts.SeriesOptionsType =
      type === 'candlestick'
        ? {
            type: 'candlestick',
            id: 'price',
            name: symbol,
            data: ohlc,
            color: t.down,
            lineColor: t.down,
            upColor: t.up,
            upLineColor: t.up,
          }
        : {
            type: 'area',
            id: 'price',
            name: symbol,
            data: closes,
            color: t.line,
            lineWidth: 2,
            fillColor: {
              linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
              stops: [
                [0, t.areaTop],
                [1, t.areaBottom],
              ],
            },
          }

    return {
      chart: {
        backgroundColor: 'transparent',
        style: { fontFamily: FONT },
        height: 460,
        spacing: [8, 0, 4, 0],
        animation: { duration: 250 },
      },
      credits: { enabled: false },
      accessibility: { enabled: false },
      rangeSelector: { enabled: false },
      scrollbar: { enabled: false },
      navigator: {
        height: 42,
        margin: 14,
        maskInside: true,
        maskFill: t.navigatorMask,
        outlineColor: t.axisLine,
        outlineWidth: 1,
        adaptToUpdatedData: true,
        series: {
          type: 'area',
          color: t.navigatorSeries,
          lineColor: t.navigatorSeries,
          lineWidth: 1,
          fillOpacity: 0.18,
        },
        handles: {
          width: 10,
          height: 22,
          backgroundColor: t.tooltipBg,
          borderColor: t.muted,
        },
        xAxis: { gridLineColor: t.grid, labels: { style: { color: t.muted, fontSize: '10px' } } },
      },
      xAxis: {
        type: 'datetime',
        ordinal: true,
        minRange: 5 * DAY_MS, // a few trading days, so the handles never cross
        lineColor: t.axisLine,
        tickColor: t.axisLine,
        gridLineColor: t.grid,
        gridLineWidth: 1,
        labels: { style: { color: t.muted, fontSize: '11px' } },
        crosshair: { color: t.crosshair, dashStyle: 'Dash', width: 1 },
        events: {
          afterSetExtremes(e) {
            const axis = e.target as unknown as { dataMin: number; dataMax: number }
            const full = e.min <= axis.dataMin && e.max >= axis.dataMax
            const min = e.min
            const max = e.max
            // Coalesce the drag's burst of events into one update per frame.
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
            rafRef.current = requestAnimationFrame(() => {
              setZoomed(!full)
              onRangeRef.current?.(full ? null : { min, max })
            })
          },
        },
      },
      yAxis: [
        {
          // Price pane
          labels: {
            align: 'right',
            x: -8,
            style: { color: t.muted, fontFamily: MONO, fontSize: '11px' },
            formatter() {
              return usd(this.value as number)
            },
          },
          gridLineColor: t.grid,
          height: '72%',
          resize: { enabled: false },
          crosshair: { color: t.crosshair, dashStyle: 'Dash', width: 1, snap: false },
          opposite: true,
        },
        {
          // Volume pane
          labels: {
            align: 'right',
            x: -8,
            style: { color: t.muted, fontFamily: MONO, fontSize: '10px' },
            formatter() {
              return compact(this.value as number)
            },
          },
          gridLineColor: t.grid,
          gridLineWidth: 1,
          top: '76%',
          height: '24%',
          offset: 0,
          opposite: true,
        },
      ],
      tooltip: {
        shared: true,
        split: false,
        useHTML: true,
        backgroundColor: t.tooltipBg,
        borderColor: t.tooltipBorder,
        borderRadius: 10,
        borderWidth: 1,
        shadow: false,
        style: { color: t.text, fontSize: '12px' },
        padding: 0,
        formatter() {
          const pts = this.points ?? []
          const price = pts.find((p) => p.series.options.id === 'price')
          const vol = pts.find((p) => p.series.type === 'column')
          const d = new Date(this.x as number)
          const date = d.toLocaleDateString('en-US', {
            timeZone: 'UTC',
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
          const p = price?.point as unknown as
            | { open: number; high: number; low: number; close: number; y?: number }
            | undefined

          const row = (label: string, value: string, cls = '') =>
            `<div class="tt-row"><span class="tt-k">${label}</span><span class="tt-v ${cls}">${value}</span></div>`

          let body = ''
          if (p && p.open != null) {
            const up = p.close >= p.open
            const chg = ((p.close - p.open) / p.open) * 100
            body =
              row('Open', usd(p.open)) +
              row('High', usd(p.high)) +
              row('Low', usd(p.low)) +
              row('Close', usd(p.close), up ? 'tt-up' : 'tt-down') +
              row('Change', `${up ? '+' : ''}${chg.toFixed(2)}%`, up ? 'tt-up' : 'tt-down')
          } else if (p) {
            body = row('Close', usd((p.y ?? 0) as number))
          }
          if (vol) body += row('Volume', compact(vol.y as number))

          return `<div class="tt"><div class="tt-head">${date}</div>${body}</div>`
        },
      },
      plotOptions: {
        candlestick: { lineWidth: 1, pointPadding: 0.12 },
        area: { threshold: null, marker: { enabled: false } },
        column: { borderWidth: 0, pointPadding: 0.05, groupPadding: 0.1 },
        series: { states: { hover: { lineWidthPlus: 0 } } },
      },
      series: [
        priceSeries,
        {
          type: 'column',
          name: 'Volume',
          data: volume,
          yAxis: 1,
          color: t.volUp,
        },
      ],
    }
  }, [bars, symbol, type, t])

  // immutable rebuilds the whole chart on every options change (ticker/range/
  // type/theme). The teardown reflows the page and the browser snaps scroll to
  // the top, so snapshot the position each render and put it back after the
  // rebuild — once synchronously and once after the navigator's async reflow.
  const scrollY = useRef(0)
  scrollY.current = window.scrollY
  useLayoutEffect(() => {
    const y = scrollY.current
    if (window.scrollY !== y) window.scrollTo(0, y)
    const id = requestAnimationFrame(() => {
      if (window.scrollY !== y) window.scrollTo(0, y)
    })
    return () => cancelAnimationFrame(id)
  }, [options])

  return (
    <div className="card chart-card">
      <div className="chart-head">
        <h3 className="card-title">{symbol} · Price &amp; Volume</h3>
        <div className="chart-actions">
          {zoomed && (
            <button className="reset-zoom" onClick={resetZoom}>
              Reset range
            </button>
          )}
          <div className="segmented" role="tablist" aria-label="Chart type">
            <button
              role="tab"
              aria-selected={type === 'candlestick'}
              className={`seg ${type === 'candlestick' ? 'seg-active' : ''}`}
              onClick={() => setType('candlestick')}
            >
              Candles
            </button>
            <button
              role="tab"
              aria-selected={type === 'area'}
              className={`seg ${type === 'area' ? 'seg-active' : ''}`}
              onClick={() => setType('area')}
            >
              Area
            </button>
          </div>
        </div>
      </div>
      {/* Fixed-height shell so the page never reflows when immutable tears the
          chart down and rebuilds it. Without it the inner container collapses
          for a frame and the scroll jumps to the top — Chrome hides this with
          scroll anchoring, Opera and others don't. */}
      <div className="chart-canvas">
        <HighchartsReact
          // Ticker/range/type changes update the existing chart in place. Only a
          // theme flip forces a full remount (key change): a plain update() of
          // the navigator's colours there compounds its layout and shrinks the
          // price pane until it vanishes, so we rebuild from scratch instead.
          key={t.mode}
          ref={chartRef}
          highcharts={Highcharts}
          constructorType="stockChart"
          options={options}
        />
      </div>
    </div>
  )
}
