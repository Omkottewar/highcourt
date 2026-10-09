import { useState } from 'react'
import { Spinner } from './UI'
import { login } from '../lib/database'

export default function Login({ onSignedIn }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async e => {
    e.preventDefault()
    if (!username.trim() || !password) { setError('Enter your username and password.'); return }
    setBusy(true); setError('')
    try {
      const user = await login(username.trim(), password)
      onSignedIn(user)
    } catch (e) { setError(e.message); setBusy(false) }
  }

  const switchServer = async () => {
    if (!window.confirm('Disconnect from this server and set up again?')) return
    await window.desktop.resetMode()
  }

  return (
    <div className="setup-shell">
      <form className="setup-card login-card" onSubmit={handleSubmit}>
        <h1>Sign in</h1>
        <p className="setup-sub">{window.desktop?.mode === 'client'
          ? <>Connected to <code>{window.desktop?.serverUrl}</code></>
          : <>Main server PC — sign in with your admin or clerk account.</>}</p>

        <label className="form-label">Username</label>
        <input className="form-input" autoFocus value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" />

        <label className="form-label" style={{ marginTop: 10 }}>Password</label>
        <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />

        {error && <div className="alert alert-error" style={{ marginTop: 12 }}><span>✕</span>{error}</div>}

        <div className="setup-actions" style={{ marginTop: 16 }}>
          {window.desktop?.mode === 'client' && <button type="button" className="btn btn-ghost" onClick={switchServer} disabled={busy}>Change server</button>}
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <Spinner size={14} /> : 'Sign in'}</button>
        </div>
      </form>
    </div>
  )
}
