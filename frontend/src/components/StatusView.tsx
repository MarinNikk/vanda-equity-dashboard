// The three non-data states. `error` (request failed) is distinct from `empty`
// (request succeeded, no data in this window).

type Props =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'error'; message: string; onRetry: () => void }

export default function StatusView(props: Props) {
  if (props.kind === 'loading') {
    return (
      <div className="status-view">
        <div className="spinner" aria-label="Loading" />
        <p className="muted">Loading market data…</p>
      </div>
    )
  }

  if (props.kind === 'empty') {
    return (
      <div className="status-view">
        <p className="status-emoji">📭</p>
        <p>No data for this symbol in the selected range.</p>
        <p className="muted">Try a wider date range.</p>
      </div>
    )
  }

  return (
    <div className="status-view">
      <p className="status-emoji">⚠️</p>
      <p>Couldn’t load market data.</p>
      <p className="muted">{props.message}</p>
      <button className="btn-secondary" onClick={props.onRetry}>
        Retry
      </button>
    </div>
  )
}
