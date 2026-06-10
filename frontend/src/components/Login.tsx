import { useState } from 'react'

import { ApiError } from '../api/client'
import { useLogin } from '../api/hooks'
import ThemeToggle from './ThemeToggle'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const login = useLogin()

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    login.mutate({ username, password })
  }

  // 401 -> bad credentials; anything else -> an unexpected/backend problem.
  const errorMessage =
    login.error instanceof ApiError
      ? login.error.status === 401
        ? 'Invalid username or password.'
        : login.error.message
      : login.isError
        ? 'Something went wrong. Please try again.'
        : null

  return (
    <div className="login-screen">
      <div className="floating-toggle">
        <ThemeToggle />
      </div>

      <form className="card login-card" onSubmit={onSubmit}>
        <div className="login-brand">
          <span className="brand-mark login-mark" aria-hidden>
            ◆
          </span>
          <h1 className="login-title">Vanda</h1>
        </div>
        <p className="muted login-sub">Equity Analytics — sign in to continue.</p>

        <label className="field">
          <span>Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {errorMessage && <p className="error-text">{errorMessage}</p>}

        <button className="btn-primary" type="submit" disabled={login.isPending}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="muted demo-hint">Demo · Marin / marin123</p>
      </form>
    </div>
  )
}
