import { useState, useEffect, useCallback } from 'react'
import { searchCases, getDistricts, getCaseTypes, softDeleteCase, getCaseById, supabase } from '../lib/supabase'
import { Spinner, CaseBadge, EmptyState, Pagination, Confirm } from '../components/UI'
import CaseForm from '../components/CaseForm'
import CaseDetail from '../components/CaseDetail'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'

const PAGE_SIZE = 50

function formatDate(dateStr) {
  if (!dateStr || dateStr === '1900-01-01') return 'Unknown'
  try { return format(new Date(dateStr), 'dd/MM/yy') } catch { return '—' }
}

export default function CasesPage() {
  const { staff }          = useAuth()
  const [cases, setCases]  = useState([])
  const [total, setTotal]  = useState(0)
  const [page, setPage]    = useState(0)
  const [loading, setLoading] = useState(false)

  const [query, setQuery]           = useState('')
  const [districtId, setDistrictId] = useState('')
  const [caseTypeId, setCaseTypeId] = useState('')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')
  const [cyear, setCyear]           = useState('')
  const [sortField, setSortField]   = useState('dated')
  const [sortAsc, setSortAsc]       = useState(false)

  const [districts, setDistricts]  = useState([])
  const [caseTypes, setCaseTypes]  = useState([])

  const [showForm, setShowForm]         = useState(false)
  const [editCase, setEditCase]         = useState(null)
  const [detailCase, setDetailCase]     = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [delReason, setDelReason]       = useState('')

  useEffect(() => {
    getDistricts().then(r => setDistricts(r.data || []))
    getCaseTypes().then(r => setCaseTypes(r.data || []))
  }, [])

  const load = useCallback(async (pg = 0) => {
    setLoading(true)
    const { data, count } = await searchCases({
      query, districtId, caseTypeId, dateFrom, dateTo, cyear,
      sortField, sortAsc, page: pg, pageSize: PAGE_SIZE
    })
    setCases(data || [])
    setTotal(count || 0)
    setPage(pg)
    setLoading(false)
  }, [query, districtId, caseTypeId, dateFrom, dateTo, cyear, sortField, sortAsc])

  useEffect(() => { load(0) }, [districtId, caseTypeId, dateFrom, dateTo, cyear, sortField, sortAsc]) // eslint-disable-line

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(a => !a)
    } else {
      setSortAsc(field === 'petitioner')
      setSortField(field)
    }
  }
  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="sort-idle">⇅</span>
    return <span className="sort-active">{sortAsc ? '▲' : '▼'}</span>
  }

  const handleSearch = e => { e.preventDefault(); load(0) }

  const openDetail = async (c) => {
    const { data } = await getCaseById(c.id)
    if (data) setDetailCase(data)
  }

  const openEdit = async (c) => {
    const { data } = await supabase.from('cases').select('*').eq('id', c.id).single()
    setEditCase(data || null)
    setShowForm(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await softDeleteCase(deleteTarget.id, delReason, staff?.id)
    setDeleteTarget(null)
    setDelReason('')
    load(page)
  }

  const canEdit   = ['admin', 'supervisor', 'operator'].includes(staff?.role)
  const canDelete = staff?.role === 'admin'

  const regdLabel = (c) => `${c.regd_no}/${c.cyear === 1990 ? 'Unknown' : c.cyear}`

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Cases</h1>
          <p className="page-subtitle">{total} records</p>
        </div>
        {canEdit && (
          <button className="btn btn-gold" onClick={() => { setEditCase(null); setShowForm(true) }}>
            + New case
          </button>
        )}
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="search-bar">
        <div className="search-input-wrap" style={{ minWidth: 280 }}>
          <span className="icon">⌕</span>
          <input className="form-input search-input" value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search petitioner or advocate…" />
        </div>
        <button className="btn btn-primary" type="submit">Search</button>
        {(query || districtId || caseTypeId || dateFrom || dateTo || cyear) && (
          <button className="btn btn-ghost" type="button" onClick={() => {
            setQuery(''); setDistrictId(''); setCaseTypeId('')
            setDateFrom(''); setDateTo(''); setCyear('')
          }}>
            Clear
          </button>
        )}
      </form>

      {/* Filters */}
      <div className="filters-row">
        <select className="form-select" style={{ width: 'auto', minWidth: 140 }}
          value={districtId} onChange={e => setDistrictId(e.target.value)}>
          <option value="">All districts</option>
          {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="form-select" style={{ width: 'auto', minWidth: 130 }}
          value={caseTypeId} onChange={e => setCaseTypeId(e.target.value)}>
          <option value="">All types</option>
          {caseTypes.map(t => <option key={t.id} value={t.id}>{t.short_code} — {t.long_name}</option>)}
        </select>
        <input className="form-input" type="number" placeholder="Year" value={cyear}
          onChange={e => setCyear(e.target.value)}
          style={{ width: 90 }} min="1990" max="2099" />
        <input className="form-input" type="date" value={dateFrom}
          onChange={e => setDateFrom(e.target.value)} style={{ width: 150 }} />
        <span style={{ fontSize: 12, color: 'var(--text-light)', padding: '0 4px' }}>to</span>
        <input className="form-input" type="date" value={dateTo}
          onChange={e => setDateTo(e.target.value)} style={{ width: 150 }} />
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div className="loading-row"><Spinner /></div>
          ) : cases.length === 0 ? (
            <EmptyState icon="📋" text="No cases found for the current filters" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th className="sort-th" onClick={() => handleSort('regd_no')}>Regd. No.<SortIcon field="regd_no" /></th>
                  <th>Type</th>
                  <th className="sort-th" onClick={() => handleSort('petitioner')}>Petitioner<SortIcon field="petitioner" /></th>
                  <th>Respondent</th>
                  <th>Advocate</th>
                  <th className="sort-th" onClick={() => handleSort('dated')}>Date<SortIcon field="dated" /></th>
                  <th>District</th>
                  <th className="sort-th" onClick={() => handleSort('copies')}>Copies<SortIcon field="copies" /></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cases.map(c => (
                  <tr key={c.id} onClick={() => openDetail(c)}>
                    <td className="mono">{regdLabel(c)}</td>
                    <td><CaseBadge type={c.case_types?.short_code} /></td>
                    <td className="truncate" style={{ maxWidth: 180 }}>{c.petitioner}</td>
                    <td className="truncate muted" style={{ maxWidth: 160 }}>—</td>
                    <td className="truncate muted" style={{ maxWidth: 140 }}>{c.advocates?.full_name || c.adv_name_raw || '—'}</td>
                    <td className="mono muted">{formatDate(c.dated)}</td>
                    <td><span className="badge badge-dist">{c.districts?.name}</span></td>
                    <td className="mono muted">{c.copies}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {canEdit && (
                          <button className="btn btn-ghost btn-sm btn-icon"
                            title="Edit" onClick={() => openEdit(c)}>✎</button>
                        )}
                        {canDelete && (
                          <button className="btn btn-danger btn-sm btn-icon"
                            title="Delete" onClick={() => setDeleteTarget(c)}>✕</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={pg => load(pg)} />
      </div>

      <CaseForm open={showForm} onClose={() => setShowForm(false)}
        editCase={editCase} onSaved={() => load(page)}
        districts={districts} caseTypes={caseTypes} />

      <CaseDetail open={!!detailCase} onClose={() => setDetailCase(null)}
        caseData={detailCase} userRole={staff?.role} />

      <Confirm
        open={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDelReason('') }}
        onConfirm={handleDelete}
        title="Delete case"
        danger
        message={
          <div>
            <p>Are you sure you want to delete case <strong>{deleteTarget?.regd_no}/{deleteTarget?.cyear}</strong>? This action will soft-delete the record — it can be recovered by an admin.</p>
            <div style={{ marginTop: 12 }}>
              <label className="form-label">Reason for deletion</label>
              <textarea className="form-textarea" value={delReason} onChange={e => setDelReason(e.target.value)} placeholder="Enter reason…" style={{ minHeight: 60 }} />
            </div>
          </div>
        }
      />
    </div>
  )
}
