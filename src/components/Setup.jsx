import { useState } from 'react'
import { Spinner } from './UI'

export default function Setup() {
  const [choice, setChoice] = useState(null)
  const [serverUrl, setServerUrl] = useState('http://192.168.1.10:4788')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const chooseMain = async () => {
    setSaving(true); setError('')
    try { await window.desktop.setMode('main') }
    catch (e) { setError(e.message); setSaving(false) }
  }
  const chooseClient = async () => {
    setSaving(true); setError('')
    try {
      const url = serverUrl.trim().replace(/\/+$/, '')
      const res = await fetch(`${url}/health`)
      if (!res.ok) throw new Error('Server did not respond at that address.')
      await window.desktop.setMode('client', url)
    } catch (e) { setError(e.message); setSaving(false) }
  }

  return (
    <div className="setup-shell">
      <div className="setup-card">
        <h1>Set up CourtDesk</h1>
        <p className="setup-sub">Choose how this PC should run CourtDesk. You can change this later from the Workspace menu.</p>

        {!choice && (
          <div className="setup-choices">
            <button className="setup-choice" onClick={() => setChoice('main')}>
              <strong>Main server PC</strong>
              <span>This PC stores the case database and PDFs. Other PCs on the office network connect to it.</span>
            </button>
            <button className="setup-choice" onClick={() => setChoice('client')}>
              <strong>Clerk PC</strong>
              <span>This PC does not store data. It connects to the main server over the office network.</span>
            </button>
          </div>
        )}

        {choice === 'main' && (
          <div className="setup-step">
            <p>This PC will:</p>
            <ul>
              <li>Keep the SQLite database and PDF attachments locally</li>
              <li>Run a server on port <b>4788</b> so clerk PCs can connect</li>
              <li>Allow adding users, who can log in from other PCs</li>
            </ul>
            <p className="form-hint">Windows Firewall may ask you to allow network access the first time — click <b>Allow</b> for the private network.</p>
            {error && <div className="alert alert-error"><span>✕</span>{error}</div>}
            <div className="setup-actions">
              <button className="btn btn-ghost" onClick={() => setChoice(null)} disabled={saving}>Back</button>
              <button className="btn btn-primary" onClick={chooseMain} disabled={saving}>{saving ? <Spinner size={14} /> : 'Set as Main server'}</button>
            </div>
          </div>
        )}

        {choice === 'client' && (
          <div className="setup-step">
            <p>Enter the main server address (ask your admin for this).</p>
            <label className="form-label">Server address</label>
            <input className="form-input" value={serverUrl} onChange={e => setServerUrl(e.target.value)} placeholder="http://192.168.1.10:4788" autoFocus />
            <span className="form-hint">Starts with <code>http://</code> and includes the port. Example: <code>http://192.168.1.10:4788</code></span>
            {error && <div className="alert alert-error"><span>✕</span>{error}</div>}
            <div className="setup-actions">
              <button className="btn btn-ghost" onClick={() => setChoice(null)} disabled={saving}>Back</button>
              <button className="btn btn-primary" onClick={chooseClient} disabled={saving}>{saving ? <Spinner size={14} /> : 'Connect'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
