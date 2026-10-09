import { useState, useEffect } from 'react'
import { Modal, Alert, Spinner } from './UI'

// Default password required to confirm a case deletion.
// Change this string to update the office password.
const DELETE_PASSWORD = 'delete@2026'

export default function DeletePasswordConfirm({ open, onClose, onConfirm, caseData }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) { setPassword(''); setError('') }
  }, [open])

  if (!caseData) return null

  const handleConfirm = async () => {
    if (password !== DELETE_PASSWORD) { setError('Incorrect password.'); return }
    setBusy(true)
    try { await onConfirm() }
    finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} size="440px" title="Delete this case?"
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-danger" onClick={handleConfirm} disabled={busy || !password}>{busy ? <Spinner size={14} /> : 'Delete case'}</button>
      </>}>
      <p className="dialog-intro">
        Case <strong>#{caseData.RegdNo}</strong>{caseData.CYear ? ` / ${caseData.CYear}` : ''} will be permanently removed from the register. This action cannot be undone.
      </p>
      <p className="form-hint" style={{ marginBottom: 12 }}>Enter the office delete password to confirm.</p>
      {error && <Alert type="error">{error}</Alert>}
      <div className="form-group" style={{ marginTop: 10 }}>
        <label className="form-label">Password<span className="req">*</span></label>
        <input className="form-input" type="password" autoFocus value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && password) handleConfirm() }}
          placeholder="Enter delete password" autoComplete="off" />
      </div>
    </Modal>
  )
}
