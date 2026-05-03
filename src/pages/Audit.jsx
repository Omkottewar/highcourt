import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Spinner, EmptyState, Pagination } from '../components/UI'
import { format } from 'date-fns'

const PAGE_SIZE = 60

export default function AuditPage() {
  const [logs, setLogs]   = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [action, setAction]   = useState('')

  const load = async (pg = 0) => {
    setLoading(true)
    let q = supabase.from('audit_log')
      .select('*, staff(full_name)', { count: 'exact' })
      .order('changed_at', { ascending: false })
      .range(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE - 1)
    if (action) q = q.eq('action', action)
    const { data, count } = await q
    setLogs(data || [])
    setTotal(count || 0)
    setPage(pg)
    setLoading(false)
  }

  useEffect(() => { load(0) }, [action]) // eslint-disable-line

  const actionColor = { INSERT: 'badge-wp', UPDATE: 'badge-dist', DELETE: 'badge-cp' }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">Immutable record of all changes · {total} entries</p>
        </div>
      </div>

      <div className="filters-row">
        {['', 'INSERT', 'UPDATE', 'DELETE'].map(a => (
          <div key={a} className={`filter-chip ${action === a ? 'active' : ''}`} onClick={() => setAction(a)}>
            {a || 'All actions'}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? <div className="loading-row"><Spinner /></div>
          : logs.length === 0 ? <EmptyState icon="📋" text="No audit log entries" />
          : (
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Table</th>
                  <th>Column</th>
                  <th>Changed by</th>
                  <th>Old value</th>
                  <th>New value</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}>
                    <td className="mono muted" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                      {l.changed_at ? format(new Date(l.changed_at), 'dd/MM/yy HH:mm') : '—'}
                    </td>
                    <td><span className={`badge ${actionColor[l.action] || 'badge-other'}`}>{l.action}</span></td>
                    <td className="mono muted">{l.table_name}</td>
                    <td className="mono muted">{l.column_changed || '—'}</td>
                    <td>{l.staff?.full_name || '—'}</td>
                    <td className="truncate muted" style={{ maxWidth: 140, fontSize: 12 }}>{l.old_value ? l.old_value.slice(0, 60) + (l.old_value.length > 60 ? '…' : '') : '—'}</td>
                    <td className="truncate muted" style={{ maxWidth: 140, fontSize: 12 }}>{l.new_value ? l.new_value.slice(0, 60) + (l.new_value.length > 60 ? '…' : '') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={pg => load(pg)} />
      </div>
    </div>
  )
}
