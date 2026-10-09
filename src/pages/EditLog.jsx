import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, X, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { Spinner, Pagination } from '../components/UI'
import { getEditLog, listUsers } from '../lib/database'

const ACTION_LABELS = {
  'auth.login': 'Signed in',
  'auth.logout': 'Signed out',
  'case.create': 'Created case',
  'case.update': 'Updated case',
  'case.caseNumber': 'Updated case number',
  'case.delete': 'Deleted case',
  'case.import': 'Imported cases',
  'case.pdfUpload': 'Uploaded PDF',
  'user.create': 'Created user',
  'user.update': 'Updated user',
}
const actionLabel = a => ACTION_LABELS[a] || a

function describeChanges(entry) {
  if (!entry.changes) return ''
  const c = entry.changes
  if (entry.action === 'case.caseNumber') return `${c.from ?? '—'} → ${c.to ?? '—'}`
  if (entry.action === 'case.import') return `${c.imported || 0} imported, ${c.skipped || 0} skipped`
  if (entry.action === 'user.create') return `${c.username} · ${c.role}`
  if (entry.action === 'user.update') {
    const parts = []
    if (c.target) parts.push(c.target)
    if (c.password) parts.push('password reset')
    if (c.enabled != null) parts.push(c.enabled ? 'enabled' : 'disabled')
    if (c.role) parts.push(`role → ${c.role}`)
    return parts.join(' · ')
  }
  try { return JSON.stringify(c) } catch { return '' }
}

export default function EditLogPage() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize] = useState(50)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [users, setUsers] = useState([])
  const [filters, setFilters] = useState({ user_id: '', action: '', since: '', until: '' })

  const load = useCallback(async (pg = 0) => {
    setLoading(true); setError('')
    const payload = { limit: pageSize, offset: pg * pageSize }
    if (filters.user_id) payload.user_id = Number(filters.user_id)
    if (filters.action) payload.action = filters.action
    if (filters.since) payload.since = filters.since + 'T00:00:00.000Z'
    if (filters.until) payload.until = filters.until + 'T23:59:59.999Z'
    const { data, error: e } = await getEditLog(payload)
    if (e) { setError(e.message); setEntries([]); setTotal(0) }
    else { setEntries(data.data || []); setTotal(data.count || 0); setPage(pg) }
    setLoading(false)
  }, [filters, pageSize])
  useEffect(() => { load(0) }, [load])
  useEffect(() => { listUsers().then(({ data }) => setUsers(data || [])) }, [])

  const reset = () => setFilters({ user_id: '', action: '', since: '', until: '' })

  return (
    <div className="app-shell">
      <main className="main-content">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="icon-button" title="Back to cases" onClick={() => navigate('/cases')}><ArrowLeft size={18} /></button>
            <h1 className="page-title">Edit log<span className="title-dot">.</span></h1>
          </div>
          <div className="header-actions">
            <button className="icon-button" title="Refresh" onClick={() => load(page)} disabled={loading}><RefreshCw size={17} /></button>
          </div>
        </div>

        {error && <div className="alert alert-error"><span>✕</span>{error}<button className="icon-button" onClick={() => setError('')} aria-label="Dismiss"><X size={14} /></button></div>}

        <section className="register-panel">
          <div className="advanced-filters" style={{ marginBottom: 0 }}>
            <div className="advanced-title"><span>Filter log entries</span>
              <div><button className="text-button" onClick={reset}>Reset all</button></div>
            </div>
            <div className="filter-grid">
              <label>User
                <select className="form-select" value={filters.user_id} onChange={e => setFilters(f => ({ ...f, user_id: e.target.value }))}>
                  <option value="">All users</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.username} ({u.role})</option>)}
                </select>
              </label>
              <label>Action
                <select className="form-select" value={filters.action} onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}>
                  <option value="">All actions</option>
                  {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label>From<input className="form-input" type="date" value={filters.since} onChange={e => setFilters(f => ({ ...f, since: e.target.value }))} /></label>
              <label>Through<input className="form-input" type="date" value={filters.until} onChange={e => setFilters(f => ({ ...f, until: e.target.value }))} /></label>
            </div>
          </div>

          <div className="table-wrap">
            {loading ? <div className="loading-row"><Spinner /><span>Loading log…</span></div> :
             !entries.length ? <div className="empty-state"><div className="empty-text">No log entries for the selected filters.</div></div> :
             <table className="resizable-table">
              <thead><tr>
                <th style={{ width: 150 }}>Time</th>
                <th style={{ width: 130 }}>User</th>
                <th style={{ width: 160 }}>Action</th>
                <th style={{ width: 110 }}>Case</th>
                <th>Details</th>
              </tr></thead>
              <tbody>{entries.map(e => <tr key={e.id}>
                <td style={{ fontSize: 11, color: '#425a3c', fontVariantNumeric: 'tabular-nums' }}>{(() => { try { return format(new Date(e.timestamp), 'dd MMM yyyy, HH:mm:ss') } catch { return e.timestamp } })()}</td>
                <td><strong>{e.username}</strong></td>
                <td>{actionLabel(e.action)}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{e.case_regd_no ? `${e.case_regd_no}${e.case_year ? '/' + e.case_year : ''}` : '—'}</td>
                <td style={{ fontSize: 11, color: '#425a3c' }}>{describeChanges(e)}</td>
              </tr>)}</tbody>
             </table>}
          </div>
          <div className="table-footer">
            <span>{total ? `${(page * pageSize + 1).toLocaleString('en-IN')}–${Math.min((page + 1) * pageSize, total).toLocaleString('en-IN')}` : '0'} of <strong>{total.toLocaleString('en-IN')}</strong> entries</span>
            <Pagination page={page} total={total} pageSize={pageSize} onChange={pg => load(pg)} disabled={loading} />
          </div>
        </section>
      </main>
    </div>
  )
}
