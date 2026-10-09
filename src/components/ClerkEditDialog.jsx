import { useState, useEffect } from 'react'
import { Modal, Alert, Spinner } from './UI'
import { updateCaseNumber } from '../lib/database'

export default function ClerkEditDialog({ open, onClose, caseData, onSaved }) {
  const [caseNumber, setCaseNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !caseData) return
    setCaseNumber(caseData.CaseNumber || '')
    setError('')
  }, [open, caseData])

  if (!caseData) return null

  const handleSave = async () => {
    const value = String(caseNumber || '').trim()
    if (value && (!/^\d+$/.test(value) || Number(value) <= 0)) {
      setError('Case number must be a positive whole number.')
      return
    }
    setSaving(true); setError('')
    const result = await updateCaseNumber({ id: caseData.id, RegdNo: caseData.RegdNo, CYear: caseData.CYear }, value || null)
    setSaving(false)
    if (result.error) { setError(result.error.message); return }
    onSaved?.()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} size="500px" title={`Update case number — ${caseData.RegdNo}`}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn btn-gold" onClick={handleSave} disabled={saving}>{saving ? <Spinner size={14} /> : 'Save'}</button>
      </>}>
      {error && <Alert type="error">{error}</Alert>}
      <p className="dialog-intro">As a clerk, you can update the court-assigned case number for this case. Other fields are read-only.</p>
      <div className="form-group" style={{ marginTop: 12 }}>
        <label className="form-label">Petitioner</label>
        <div className="form-input" style={{ background: '#f5f7f3', pointerEvents: 'none' }}>{caseData.Petitioner || '—'}</div>
      </div>
      <div className="form-row form-row-2">
        <div className="form-group">
          <label className="form-label">Regd. No.</label>
          <div className="form-input" style={{ background: '#f5f7f3', pointerEvents: 'none' }}>{caseData.RegdNo}</div>
        </div>
        <div className="form-group">
          <label className="form-label">Year</label>
          <div className="form-input" style={{ background: '#f5f7f3', pointerEvents: 'none' }}>{caseData.CYear || '—'}</div>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Case number (court-assigned)<span className="req">*</span></label>
        <input className="form-input" autoFocus type="number" inputMode="numeric" min="1" step="1"
          value={caseNumber} onChange={e => setCaseNumber(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="e.g. 7373" />
        <span className="form-hint">Enter the number assigned by the court. Leave blank to clear it.</span>
      </div>
    </Modal>
  )
}
