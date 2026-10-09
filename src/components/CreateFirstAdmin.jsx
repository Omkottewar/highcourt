import { useState } from 'react'
import { Spinner, Alert } from './UI'
import { createFirstAdmin } from '../lib/database'

export default function CreateFirstAdmin({ onCreated }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async e => {
    e.preventDefault()
    if (!/^[A-Za-z0-9._-]{3,32}$/.test(username.trim())) { setError('Username must be 3–32 characters, letters/numbers/._- only.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setBusy(true); setError('')
    try {
      const user = await createFirstAdmin(username.trim(), password)
      onCreated(user)
    } catch (e) { setError(e.message); setBusy(false) }
  }

  return (
    <div className="setup-shell">
      <form className="setup-card" onSubmit={handleSubmit}>
        <h1>Create your admin account</h1>
        <p className="setup-sub">This is the first time CourtDesk is running on this main server PC. Create the admin account you'll use to sign in. You can add more users (admins or clerks) after signing in.</p>

        {error && <Alert type="error">{error}</Alert>}

        <div className="form-group">
          <label className="form-label">Username<span className="req">*</span></label>
          <input className="form-input" autoFocus value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. admin" autoComplete="username" />
          <span className="form-hint">3–32 characters. Letters, numbers, and <code>._-</code> only.</span>
        </div>
        <div className="form-group">
          <label className="form-label">Password<span className="req">*</span></label>
          <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
        </div>
        <div className="form-group">
          <label className="form-label">Confirm password<span className="req">*</span></label>
          <input className="form-input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat the password" autoComplete="new-password" />
        </div>

        <div className="setup-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <Spinner size={14} /> : 'Create admin account'}</button>
        </div>
      </form>
    </div>
  )
}
