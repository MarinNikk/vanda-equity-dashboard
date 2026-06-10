import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

// Light/dark theme, persisted and defaulting to the OS setting. UI colours live
// in CSS variables (index.css) keyed off a `data-theme` attribute on <html>.
// Highcharts renders SVG and can't read those variables, so useChartTheme below
// mirrors the palette for the chart options.

type Theme = 'light' | 'dark'
const STORAGE_KEY = 'vanda-theme'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getInitialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggle = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}

export interface ChartTheme {
  mode: Theme
  text: string
  muted: string
  grid: string
  axisLine: string
  line: string
  areaTop: string
  areaBottom: string
  up: string
  down: string
  volUp: string
  volDown: string
  crosshair: string
  tooltipBg: string
  tooltipBorder: string
  navigatorMask: string
  navigatorSeries: string
  navigatorHandle: string
}

// Mirrors the index.css palette for the SVG charts. Stable per theme so the
// chart memo only recomputes on a flip.
export function useChartTheme(): ChartTheme {
  const { theme } = useTheme()
  return useMemo<ChartTheme>(() => {
    const dark = theme === 'dark'
    return {
      mode: theme,
      text: dark ? '#d1d4dc' : '#131722',
      muted: dark ? '#787b86' : '#6b7280',
      grid: dark ? '#1e222d' : '#eceef2',
      axisLine: dark ? '#2a2e39' : '#dfe2ea',
      line: dark ? '#5b8def' : '#2962ff',
      areaTop: dark ? 'rgba(91, 141, 239, 0.28)' : 'rgba(41, 98, 255, 0.18)',
      areaBottom: dark ? 'rgba(91, 141, 239, 0.0)' : 'rgba(41, 98, 255, 0.0)',
      up: '#26a69a',
      down: '#ef5350',
      volUp: dark ? 'rgba(38, 166, 154, 0.45)' : 'rgba(38, 166, 154, 0.40)',
      volDown: dark ? 'rgba(239, 83, 80, 0.40)' : 'rgba(239, 83, 80, 0.35)',
      crosshair: dark ? '#4a5160' : '#b2b5be',
      tooltipBg: dark ? '#1c2030' : '#ffffff',
      tooltipBorder: dark ? '#2a2e39' : '#e0e3eb',
      navigatorMask: dark ? 'rgba(41, 98, 255, 0.06)' : 'rgba(41, 98, 255, 0.05)',
      navigatorSeries: dark ? '#3a4358' : '#c7ccd8',
      navigatorHandle: dark ? '#2a2e39' : '#dfe2ea',
    }
  }, [theme])
}
