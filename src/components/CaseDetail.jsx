import { useState, useEffect } from 'react'
import { Modal, CaseBadge } from './UI'
import { format } from 'date-fns'
import { printCase } from '../utils/printCase'
import { splitRespondents } from '../utils/respondents'

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-light)', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--cream-dark)' }}>{title}</div>
      {children}
    </div>
  )
}

function fmtDate(dateStr) {
  if (!dateStr || dateStr === '1900-01-01') return 'Date Unknown'
  try { return format(new Date(dateStr), 'dd MMMM yyyy') } catch { return '—' }
}

export default function CaseDetail({ open, onClose, caseData }) {
  const [tab, setTab] = useState('details')

  useEffect(() => { if (open) setTab('details') }, [open])

  if (!caseData) return null

  const respondents = splitRespondents(caseData.Respondets)

  return (
    <Modal open={open} onClose={onClose} size="820px"
      title={`Case ${caseData.RegdNo}`}
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm"
            onClick={() => printCase(caseData)}
            title="Print case document">
            ⎙ Print
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      }>

      {/* Case header strip */}
      <div style={{ background: 'var(--navy)', borderRadius: 8, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <CaseBadge type={caseData.Type} />
        {caseData.District && <span className="badge badge-dist">{caseData.District}</span>}
        <span style={{ fontSize: 13, color: '#8896a5', marginLeft: 'auto' }}>
          Filed: {fmtDate(caseData.Dated)}
        </span>
      </div>

      <div className="tabs">
        {['details', 'respondents'].map(t => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'respondents' && respondents.length > 0 && <span style={{ marginLeft: 6, background: 'var(--gold-pale)', color: 'var(--navy)', fontSize: 11, borderRadius: 8, padding: '1px 6px' }}>{respondents.length}</span>}
          </div>
        ))}
      </div>

      {tab === 'details' && (
        <div>
          <Section title="Petitioner">
            <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--navy)' }}>{caseData.Petitioner || '—'}</p>
          </Section>
          <Section title="Case details">
            <div className="detail-panel">
              <div className="detail-field">
                <div className="detail-field-label">Registration No.</div>
                <div className="detail-field-value mono">{caseData.RegdNo}</div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Case type</div>
                <div className="detail-field-value">{caseData.Type || '—'}</div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">District</div>
                <div className="detail-field-value">{caseData.District || '—'}</div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Date filed</div>
                <div className="detail-field-value">{fmtDate(caseData.Dated)}</div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Copies</div>
                <div className="detail-field-value mono">{caseData.Copies || '—'}</div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Copy received for Resp. No.</div>
                <div className="detail-field-value mono">{caseData.RespndentNo || '—'}</div>
              </div>
              {caseData.LongType && (
                <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
                  <div className="detail-field-label">Long type</div>
                  <div className="detail-field-value">{caseData.LongType}</div>
                </div>
              )}
              {caseData.Remark && (
                <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
                  <div className="detail-field-label">Remark</div>
                  <div className="detail-field-value">{caseData.Remark}</div>
                </div>
              )}
            </div>
          </Section>
          <Section title="Advocate">
            <div className="detail-panel">
              <div className="detail-field">
                <div className="detail-field-label">Name</div>
                <div className="detail-field-value">{caseData.Adv || '—'}</div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Mobile</div>
                <div className="detail-field-value mono">{caseData.AdvMoNo || '—'}</div>
              </div>
              {caseData.AdvAddress && (
                <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
                  <div className="detail-field-label">Address</div>
                  <div className="detail-field-value">{caseData.AdvAddress}</div>
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
              {respondents.map((name, i) => (
                <div key={i} className="resp-item">
                  <div className="resp-no">{i + 1}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
