import { useState, useEffect } from 'react'
import { Modal, CaseBadge, Spinner, Alert } from '../components/UI'
import { getCaseRespondents, getCaseRemarks, getCaseHearings, addRemark, addHearing } from '../lib/supabase'
import { format } from 'date-fns'

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-light)', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--cream-dark)' }}>{title}</div>
      {children}
    </div>
  )
}

export default function CaseDetail({ open, onClose, caseData, userRole }) {
  const [tab, setTab]             = useState('details')
  const [respondents, setResp]    = useState([])
  const [remarks, setRemarks]     = useState([])
  const [hearings, setHearings]   = useState([])
  const [loading, setLoading]     = useState(false)
  const [newRemark, setNewRemark] = useState('')
  const [newHearing, setNewHearing] = useState({ hearing_date: '', court_no: '', notes: '', next_date: '' })
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState('')

  useEffect(() => {
    if (!open || !caseData) return
    setTab('details')
    setLoading(true)
    Promise.all([
      getCaseRespondents(caseData.id),
      getCaseRemarks(caseData.id),
      getCaseHearings(caseData.id),
    ]).then(([r, rm, h]) => {
      setResp(r.data || [])
      setRemarks(rm.data || [])
      setHearings(h.data || [])
      setLoading(false)
    })
  }, [open, caseData])

  const handleAddRemark = async () => {
    if (!newRemark.trim()) return
    setSaving(true)
    const { error } = await addRemark(caseData.id, newRemark.trim())
    if (error) { setMsg('Error: ' + error.message); setSaving(false); return }
    const { data } = await getCaseRemarks(caseData.id)
    setRemarks(data || [])
    setNewRemark('')
    setSaving(false)
    setMsg('Remark added')
    setTimeout(() => setMsg(''), 2500)
  }

  const handleAddHearing = async () => {
    if (!newHearing.hearing_date) return
    setSaving(true)
    const { error } = await addHearing({ case_id: caseData.id, ...newHearing })
    if (error) { setMsg('Error: ' + error.message); setSaving(false); return }
    const { data } = await getCaseHearings(caseData.id)
    setHearings(data || [])
    setNewHearing({ hearing_date: '', court_no: '', notes: '', next_date: '' })
    setSaving(false)
    setMsg('Hearing added')
    setTimeout(() => setMsg(''), 2500)
  }

  if (!caseData) return null

  return (
    <Modal open={open} onClose={onClose} size="820px"
      title={`Case ${caseData.regd_no}/${caseData.cyear}`}
      footer={<button className="btn btn-ghost" onClick={onClose}>Close</button>}>

      {/* Case header strip */}
      <div style={{ background: 'var(--navy)', borderRadius: 8, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <CaseBadge type={caseData.case_type} />
        {caseData.wp_number && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gold-light)' }}>{caseData.wp_number}</span>}
        <span className="badge badge-dist">{caseData.district}</span>
        <span style={{ fontSize: 13, color: '#8896a5', marginLeft: 'auto' }}>
          Filed: {caseData.dated ? format(new Date(caseData.dated), 'dd MMM yyyy') : '—'}
        </span>
      </div>

      <div className="tabs">
        {['details', 'respondents', 'remarks', 'hearings'].map(t => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'respondents' && respondents.length > 0 && <span style={{ marginLeft: 6, background: 'var(--gold-pale)', color: 'var(--navy)', fontSize: 11, borderRadius: 8, padding: '1px 6px' }}>{respondents.length}</span>}
          </div>
        ))}
      </div>

      {loading ? <div className="loading-row"><Spinner /></div> : <>

        {tab === 'details' && (
          <div>
            <Section title="Petitioner">
              <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--navy)' }}>{caseData.petitioner}</p>
            </Section>
            <Section title="Case details">
              <div className="detail-panel">
                <div className="detail-field">
                  <div className="detail-field-label">Registration No.</div>
                  <div className="detail-field-value mono">{caseData.regd_no}/{caseData.cyear}</div>
                </div>
                <div className="detail-field">
                  <div className="detail-field-label">Case type</div>
                  <div className="detail-field-value"><CaseBadge type={caseData.case_type} /></div>
                </div>
                <div className="detail-field">
                  <div className="detail-field-label">District</div>
                  <div className="detail-field-value">{caseData.district}{caseData.division ? ` · ${caseData.division} Division` : ''}</div>
                </div>
                <div className="detail-field">
                  <div className="detail-field-label">Date filed</div>
                  <div className="detail-field-value">{caseData.dated ? format(new Date(caseData.dated), 'dd MMMM yyyy') : '—'}</div>
                </div>
                <div className="detail-field">
                  <div className="detail-field-label">Copies</div>
                  <div className="detail-field-value mono">{caseData.copies}</div>
                </div>
                <div className="detail-field">
                  <div className="detail-field-label">WP Number</div>
                  <div className="detail-field-value mono">{caseData.wp_number || '—'}</div>
                </div>
              </div>
            </Section>
            <Section title="Advocate">
              <div className="detail-panel">
                <div className="detail-field">
                  <div className="detail-field-label">Name</div>
                  <div className="detail-field-value">{caseData.advocate_name || '—'}</div>
                </div>
                <div className="detail-field">
                  <div className="detail-field-label">Mobile</div>
                  <div className="detail-field-value mono">{caseData.advocate_mobile || '—'}</div>
                </div>
                {caseData.advocate_address && (
                  <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
                    <div className="detail-field-label">Address</div>
                    <div className="detail-field-value">{caseData.advocate_address}</div>
                  </div>
                )}
              </div>
            </Section>
          </div>
        )}

        {tab === 'respondents' && (
          <div>
            {respondents.length === 0 ? (
              <div className="empty-state" style={{ padding: 40 }}>
                <div className="empty-icon">👤</div>
                <div className="empty-text">No respondents on record</div>
              </div>
            ) : (
              <div className="resp-list">
                {respondents.map(r => (
                  <div key={r.resp_no} className="resp-item">
                    <div className="resp-no">{r.resp_no}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{r.departments?.full_name || r.resp_name_raw || '—'}</div>
                      {r.departments?.short_name && <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{r.departments.short_name}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'remarks' && (
          <div>
            {msg && <Alert type="success">{msg}</Alert>}
            {['admin','supervisor','operator'].includes(userRole) && (
              <div style={{ marginBottom: 20 }}>
                <textarea className="form-textarea" value={newRemark}
                  onChange={e => setNewRemark(e.target.value)}
                  placeholder="Add a new remark or note about this case…" />
                <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }}
                  onClick={handleAddRemark} disabled={saving || !newRemark.trim()}>
                  {saving ? <Spinner size={14} /> : 'Add remark'}
                </button>
              </div>
            )}
            {remarks.length === 0 ? (
              <div className="empty-state" style={{ padding: 30 }}><div className="empty-icon">📝</div><div className="empty-text">No remarks yet</div></div>
            ) : (
              <div className="timeline">
                {remarks.map(r => (
                  <div key={r.id} className="timeline-item">
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <div className="timeline-meta">
                        {r.staff?.full_name || 'Unknown'} · {r.added_at ? format(new Date(r.added_at), 'dd MMM yyyy, HH:mm') : ''}
                      </div>
                      <div className="timeline-text">{r.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'hearings' && (
          <div>
            {msg && <Alert type="success">{msg}</Alert>}
            {['admin','supervisor','operator'].includes(userRole) && (
              <div style={{ marginBottom: 20, padding: 16, background: 'var(--cream)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-mid)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Add hearing date</div>
                <div className="form-row form-row-2" style={{ marginBottom: 10 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Hearing date</label>
                    <input className="form-input" type="date" value={newHearing.hearing_date}
                      onChange={e => setNewHearing(h => ({ ...h, hearing_date: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Court no.</label>
                    <input className="form-input" value={newHearing.court_no} placeholder="e.g. Court 5"
                      onChange={e => setNewHearing(h => ({ ...h, court_no: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Next date</label>
                    <input className="form-input" type="date" value={newHearing.next_date}
                      onChange={e => setNewHearing(h => ({ ...h, next_date: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Outcome / notes</label>
                    <input className="form-input" value={newHearing.notes} placeholder="Adjourned, Order reserved…"
                      onChange={e => setNewHearing(h => ({ ...h, notes: e.target.value }))} />
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={handleAddHearing}
                  disabled={saving || !newHearing.hearing_date}>
                  {saving ? <Spinner size={14} /> : 'Add hearing'}
                </button>
              </div>
            )}
            {hearings.length === 0 ? (
              <div className="empty-state" style={{ padding: 30 }}><div className="empty-icon">📅</div><div className="empty-text">No hearings recorded</div></div>
            ) : (
              <div className="timeline">
                {hearings.map(h => (
                  <div key={h.id} className="timeline-item">
                    <div className="timeline-dot" style={{ background: h.next_date ? 'var(--gold)' : 'var(--text-light)' }} />
                    <div className="timeline-content">
                      <div className="timeline-meta">
                        {h.hearing_date ? format(new Date(h.hearing_date), 'dd MMMM yyyy') : '—'}
                        {h.court_no && ` · ${h.court_no}`}
                        {h.staff?.full_name && ` · ${h.staff.full_name}`}
                      </div>
                      {h.notes && <div className="timeline-text">{h.notes}</div>}
                      {h.next_date && (
                        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--gold)', fontWeight: 500 }}>
                          Next: {format(new Date(h.next_date), 'dd MMM yyyy')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </>}
    </Modal>
  )
}
