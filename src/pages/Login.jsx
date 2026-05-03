import { useState } from 'react'
import { signIn } from '../lib/supabase'
import { Alert, Spinner } from '../components/UI'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await signIn(email, password)
    if (err) setError(err.message)
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card fade-in">
        <div className="login-emblem">
          <div style={{ fontSize: 48 }}>⚖</div>
          <div className="login-emblem-title">Office of the Government Pleader</div>
          <div className="login-emblem-sub">High Court of Bombay · Bench at Nagpur</div>
        </div>
        <hr className="login-divider" />

        {error && <Alert type="error">{error}</Alert>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input className="form-input" type="email" required
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="staff@nagpur.gov.in" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" required
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
            {loading ? <Spinner size={16} /> : 'Sign in'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'var(--text-light)' }}>
          Contact system administrator for access
        </p>
      </div>
    </div>
  )
}
