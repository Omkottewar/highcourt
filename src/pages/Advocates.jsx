import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Modal, Spinner, EmptyState, Alert, Pagination } from '../components/UI'
import { useAuth } from '../hooks/useAuth'

const EMPTY = { full_name: '', short_name: '', mobile_no: '', address: '', email: '', bar_no: '' }
const PAGE_SIZE = 50

export default function AdvocatesPage() {
  const { staff } = useAuth()
  const [advocates, setAdvocates] = useState([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(0)
  const [loading, setLoading]     = useState(false)
  const [query, setQuery]         = useState('')
  const [form, setForm]           = useState(EMPTY)
  const [editId, setEditId]       = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')

  const load = async (pg = 0, q = query) => {
    setLoading(true)
    let qry = supabase.from('advocates').select('*', { count: 'exact' }).eq('is_active', true).order('full_name')
    if (q) qry = qry.ilike('full_name', `%${q}%`)
    const { data, count } = await qry.range(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE - 1)
    setAdvocates(data || [])
    setTotal(count || 0)
    setPage(pg)
    setLoading(false)
  }

  useEffect(() => { load(0) }, []) // eslint-disable-line

  const openNew  = () => { setForm(EMPTY); setEditId(null); setError(''); setShowModal(true) }
  const openEdit = (a) => { setForm({ full_name: a.full_name, short_name: a.short_name || '', mobile_no: a.mobile_no || '', address: a.address || '', email: a.email || '', bar_no: a.bar_no || '' }); setEditId(a.id); setError(''); setShowModal(true) }

  const handleSave = async () => {
    if (!form.full_name.trim()) { setError('Full name is required'); return }
    setSaving(true)
    const payload = { ...form, full_name: form.full_name.trim().toUpperCase() }
    if (editId) {
      const { error: e } = await supabase.from('advocates').update(payload).eq('id', editId)
      if (e) { setError(e.message); setSaving(false); return }
    } else {
      const { error: e } = await supabase.from('advocates').insert(payload)
      if (e) { setError(e.message); setSaving(false); return }
    }
    setSaving(false)
    setShowModal(false)
    setSuccess(`Advocate ${editId ? 'updated' : 'added'} successfully`)
    setTimeout(() => setSuccess(''), 3000)
    load(page)
  }

  const canEdit = ['admin','supervisor'].includes(staff?.role)

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Advocates</h1>
          <p className="page-subtitle">{total} advocates on record</p>
        </div>
        {canEdit && <button className="btn btn-gold" onClick={openNew}>+ Add advocate</button>}
      </div>

      {success && <Alert type="success">{success}</Alert>}

      <form onSubmit={e => { e.preventDefault(); load(0, query) }} className="search-bar">
        <div className="search-input-wrap">
          <span className="icon">⌕</span>
          <input className="form-input search-input" value={query}
            onChange={e => setQuery(e.target.value)} placeholder="Search by name…" />
        </div>
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      <div className="card">
        <div className="table-wrap">
          {loading ? <div className="loading-row"><Spinner /></div>
          : advocates.length === 0 ? <EmptyState icon="👤" text="No advocates found" />
          : (
            <table>
              <thead>
                <tr>
                  <th>Full name</th>
                  <th>Short name</th>
                  <th>Mobile</th>
                  <th>Bar no.</th>
                  <th>Address</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {advocates.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 500 }}>{a.full_name}</td>
                    <td className="muted">{a.short_name || '—'}</td>
                    <td className="mono muted">{a.mobile_no || '—'}</td>
                    <td className="mono muted">{a.bar_no || '—'}</td>
                    <td className="truncate muted" style={{ maxWidth: 200 }}>{a.address || '—'}</td>
                    {canEdit && (
                      <td>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(a)}>✎</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={pg => load(pg)} />
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)}
        title={editId ? 'Edit Advocate' : 'Add Advocate'}
        size="580px"
        footer={<>
          <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving}>{saving ? <Spinner size={15} /> : 'Save'}</button>
        </>}>
        {error && <Alert type="error">{error}</Alert>}
        <div className="form-row form-row-2">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Full name <span className="req">*</span></label>
            <input className="form-input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="S.P. BHANDARKAR" />
          </div>
          <div className="form-group">
            <label className="form-label">Short name / initials</label>
            <input className="form-input" value={form.short_name} onChange={e => setForm(f => ({ ...f, short_name: e.target.value }))} placeholder="S.P.B." />
          </div>
          <div className="form-group">
            <label className="form-label">Mobile no.</label>
            <input className="form-input" value={form.mobile_no} onChange={e => setForm(f => ({ ...f, mobile_no: e.target.value }))} placeholder="9876543210" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Bar council no.</label>
            <input className="form-input" value={form.bar_no} onChange={e => setForm(f => ({ ...f, bar_no: e.target.value }))} />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Address</label>
            <textarea className="form-textarea" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={{ minHeight: 60 }} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
