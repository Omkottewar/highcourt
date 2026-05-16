import { useState, useEffect, useCallback } from 'react'
import { searchCases, getDistrictOptions, getCaseTypeOptions, deleteCase } from '../lib/supabase'
import { Spinner, CaseBadge, EmptyState, Pagination, Confirm, FilterSelect } from '../components/UI'
import CaseForm from '../components/CaseForm'
import CaseDetail from '../components/CaseDetail'
import { format } from 'date-fns'
import { printCase } from '../utils/printCase'
import { splitRespondents } from '../utils/respondents'
import { exportCasesToExcel } from '../utils/exportCases'

const PAGE_SIZE = 50

const SEARCH_FIELDS = [
  { value: 'Petitioner', label: 'Petitioner' },
  { value: 'Adv',        label: 'Advocate' },
  { value: 'Respondets', label: 'Respondent' },
  { value: 'RegdNo',     label: 'Regd. No.' },
  { value: 'Remark',     label: 'Remark' },
]

function formatDate(dateStr) {
  if (!dateStr || dateStr === '1900-01-01') return 'Unknown'
  try { return format(new Date(dateStr), 'dd/MM/yy') } catch { return '—' }
}

export default function CasesPage() {
  const [cases, setCases]  = useState([])
  const [total, setTotal]  = useState(0)
  const [page, setPage]    = useState(0)
  const [loading, setLoading] = useState(false)

  const [query, setQuery]         = useState('')
  const [searchField, setSearchField] = useState('Petitioner')
  const [district, setDistrict]   = useState('')
  const [caseType, setCaseType]   = useState('')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [cyear, setCyear]         = useState('')
  const [sortField, setSortField] = useState('Dated')
  const [sortAsc, setSortAsc]     = useState(false)

  const [districts, setDistricts] = useState([])
  const [caseTypes, setCaseTypes] = useState([])

  const [showForm, setShowForm]         = useState(false)
  const [editCase, setEditCase]         = useState(null)
  const [detailCase, setDetailCase]     = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [exporting, setExporting]       = useState(false)
  const [exportCount, setExportCount]   = useState(null)

  useEffect(() => {
    getDistrictOptions().then(({ data }) =>
      setDistricts((data || []).map(d => d.name)))
    getCaseTypeOptions().then(({ data }) =>
      setCaseTypes((data || []).map(t => t.long_type || t.short_type).filter(Boolean)))
  }, [])

  const load = useCallback(async (pg = 0) => {
    setLoading(true)
    const { data, count } = await searchCases({
      query, searchField, district, caseType, dateFrom, dateTo, cyear,
      sortField, sortAsc, page: pg, pageSize: PAGE_SIZE,
    })
    setCases(data || [])
    setTotal(count || 0)
    setPage(pg)
    setLoading(false)
  }, [query, searchField, district, caseType, dateFrom, dateTo, cyear, sortField, sortAsc])

  // Debounced auto-load: re-runs the search whenever any filter (including the
  // free-text query) changes, with a small delay so typing feels responsive
  // without firing a request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => load(0), 250)
    return () => clearTimeout(t)
  }, [query, searchField, district, caseType, dateFrom, dateTo, cyear, sortField, sortAsc]) // eslint-disable-line

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(a => !a)
    } else {
      setSortAsc(field === 'Petitioner')
      setSortField(field)
    }
  }
  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="sort-idle">⇅</span>
    return <span className="sort-active">{sortAsc ? '▲' : '▼'}</span>
  }

  const openEdit = (c) => { setEditCase(c); setShowForm(true) }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteCase({ RegdNo: deleteTarget.RegdNo, CYear: deleteTarget.CYear })
    setDeleteTarget(null)
    load(page)
  }

  const canEdit   = true
  const canDelete = true

  const handleExport = async () => {
    setExporting(true)
    setExportCount(null)
    try {
      await exportCasesToExcel(
        { query, searchField, district, caseType, dateFrom, dateTo, cyear, sortField, sortAsc },
        (fetched, total) => setExportCount({ fetched, total }),
      )
    } catch (err) {
      alert('Export failed: ' + (err?.message || err))
    }
    setExporting(false)
    setExportCount(null)
  }

  const respondentCell = (c) => {
    const list = splitRespondents(c.Respondets)
    if (list.length === 0) return '—'
    return list.length === 1 ? list[0] : `${list[0]} (+${list.length - 1} more)`
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Cases</h1>
          <p className="page-subtitle">{total} records</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={handleExport} disabled={exporting}
            title="Download all matching cases as an Excel file">
            {exporting
              ? <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <Spinner size={14} />
                  {exportCount ? `Exporting ${exportCount.fetched}/${exportCount.total}…` : 'Exporting…'}
                </span>
              : '⬇ Export to Excel'}
          </button>
          {canEdit && (
            <button className="btn btn-gold" onClick={() => { setEditCase(null); setShowForm(true) }}>
              + New case
            </button>
          )}
        </div>
      </div>

      {/* Search bar */}
      <form onSubmit={e => e.preventDefault()} className="search-bar">
        <select className="form-select" style={{ width: 'auto', minWidth: 130 }}
          value={searchField} onChange={e => setSearchField(e.target.value)}
          title="Field to search">
          {SEARCH_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <div className="search-input-wrap" style={{ minWidth: 260 }}>
          <span className="icon">⌕</span>
          <input className="form-input search-input" value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search by ${SEARCH_FIELDS.find(f => f.value === searchField)?.label.toLowerCase()}…`} />
        </div>
        {(query || district || caseType || dateFrom || dateTo || cyear) && (
          <button className="btn btn-ghost" type="button" onClick={() => {
            setQuery(''); setDistrict(''); setCaseType('')
            setDateFrom(''); setDateTo(''); setCyear('')
          }}>
            Clear
          </button>
        )}
      </form>

      {/* Filters */}
      <div className="filters-row">
        <FilterSelect value={district} onChange={setDistrict} options={districts}
          placeholder="All districts" minWidth={150} />
        <FilterSelect value={caseType} onChange={setCaseType} options={caseTypes}
          placeholder="All types" minWidth={170} />
        <input className="form-input" type="number" placeholder="Year" value={cyear}
          onChange={e => setCyear(e.target.value)}
          style={{ width: 90 }} min="1900" max="2099" />
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
                  <th className="sort-th" onClick={() => handleSort('RegdNo')}>Regd. No.<SortIcon field="RegdNo" /></th>
                  <th>Type</th>
                  <th className="sort-th" onClick={() => handleSort('Petitioner')}>Petitioner<SortIcon field="Petitioner" /></th>
                  <th>Respondent</th>
                  <th>Advocate</th>
                  <th className="sort-th" onClick={() => handleSort('Dated')}>Date<SortIcon field="Dated" /></th>
                  <th>District</th>
                  <th className="sort-th" onClick={() => handleSort('Copies')}>Copies<SortIcon field="Copies" /></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c, i) => (
                  <tr key={`${c.RegdNo}-${c.CYear}-${i}`} onClick={() => setDetailCase(c)}>
                    <td className="mono">{c.RegdNo}</td>
                    <td><CaseBadge type={c.Type} /></td>
                    <td className="truncate" style={{ maxWidth: 180 }}>{c.Petitioner}</td>
                    <td className="truncate muted" style={{ maxWidth: 200 }}>{respondentCell(c)}</td>
                    <td className="truncate muted" style={{ maxWidth: 140 }}>{c.Adv || '—'}</td>
                    <td className="mono muted">{formatDate(c.Dated)}</td>
                    <td>{c.District ? <span className="badge badge-dist">{c.District}</span> : '—'}</td>
                    <td className="mono muted">{c.Copies || '—'}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm btn-icon"
                          title="Print" onClick={() => printCase(c)}>⎙</button>
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
        editCase={editCase} onSaved={() => load(page)} />

      <CaseDetail open={!!detailCase} onClose={() => setDetailCase(null)}
        caseData={detailCase} />

      <Confirm
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete case"
        danger
        message={
          <span>
            Are you sure you want to delete case <strong>{deleteTarget?.RegdNo}</strong>?
            This permanently removes the record and cannot be undone.
          </span>
        }
      />
    </div>
  )
}
