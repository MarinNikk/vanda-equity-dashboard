import { useMe } from './api/hooks'
import Dashboard from './components/Dashboard'
import Login from './components/Login'

// auth gate: /auth/me decides login vs dashboard
export default function App() {
  const me = useMe()

  if (me.isPending) {
    return (
      <div className="center-screen">
        <p className="muted">Loading…</p>
      </div>
    )
  }

  if (me.data) {
    return <Dashboard username={me.data.username} />
  }

  return <Login />
}
