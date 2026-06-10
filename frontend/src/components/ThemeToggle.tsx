import { useTheme } from '../theme/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      className="btn-secondary theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      title="Toggle light/dark"
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  )
}
