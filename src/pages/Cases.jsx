import { useState, useEffect, useCallback, useRef } from 'react'
import { HardDrive, Download, Upload, Plus, Search, SlidersHorizontal, ArrowUpDown,
  Columns3, RefreshCw, ChevronDown, ArrowUp, ArrowDown, X, Printer, Pencil,
  CheckCheck, FolderOpen, CircleHelp, Check, LogOut, Users as UsersIcon, History } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { searchCases, getDistrictOptions, getCaseTypeOptions, deleteCase, getDatabaseInfo, backupDatabase, restoreDatabase } from '../lib/database'
import { Spinner, CaseBadge, EmptyState, Pagination, FilterSelect, Modal } from '../components/UI'
import CaseForm from '../components/CaseForm'
import CaseDetail from '../components/CaseDetail'
import ClerkEditDialog from '../components/ClerkEditDialog'
import DeletePasswordConfirm from '../components/DeletePasswordConfirm'
import ExportDialog from '../components/ExportDialog'
import ImportDialog from '../components/ImportDialog'
import { printCase } from '../utils/printCase'
import { splitRespondents } from '../utils/respondents'
import { exportCasesToExcel } from '../utils/exportCases'
import { CASE_FIELDS, DEFAULT_COLUMNS, EMPTY_FILTERS, readPreference } from '../utils/caseFields'

const SEARCH_FIELDS = CASE_FIELDS.filter(f => ['Petitioner', 'RegdNo', 'Adv', 'Respondets', 'Remark', 'AdvMoNo'].includes(f.key))
const FILTER_LABELS = { query: 'Search', district: 'District', caseType: 'Type', cyear: 'Year', dateFrom: 'From', dateTo: 'To', advocate: 'Advocate', respondent: 'Respondent', remark: 'Remark' }
const displayDate = value => {
  if (!value || value === '1900-01-01') return 'Not recorded'
  try { return format(new Date(value), 'dd MMM yyyy') } catch { return 'Not recorded' }
}
const number = value => value.toLocaleString('en-IN')

export default function CasesPage({ user, onSignOut }) {
  const navigate = useNavigate()
  const isClerk = user?.role === 'clerk'
  const isAdmin = !user || user.role === 'admin'
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [cases, setCases] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [districts, setDistricts] = useState([])
  const [caseTypes, setCaseTypes] = useState([])
  const [databaseInfo, setDatabaseInfo] = useState(null)
  const [databaseBusy, setDatabaseBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exportCount, setExportCount] = useState(null)
  const [selected, setSelected] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editCase, setEditCase] = useState(null)
  const [clerkEditCase, setClerkEditCase] = useState(null)
  const [detailCase, setDetailCase] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [dialog, setDialog] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [columns, setColumns] = useState(() => {
    const value = readPreference('case-visible-columns', DEFAULT_COLUMNS)
    return Array.isArray(value) && value.some(key => CASE_FIELDS.some(f => f.key === key))
      ? value.filter(key => CASE_FIELDS.some(f => f.key === key)) : DEFAULT_COLUMNS
  })
  const [compact, setCompact] = useState(() => readPreference('case-compact', false) === true)
  const [columnWidths, setColumnWidths] = useState(() => {
    const stored = readPreference('case-column-widths', {})
    const defaults = Object.fromEntries(CASE_FIELDS.map(f => [f.key, f.px || 140]))
    return { ...defaults, ...(stored && typeof stored === 'object' ? stored : {}) }
  })
  const resizing = useRef(null)
  const request = useRef(0)
  const searchInput = useRef()
  const busy = exporting || databaseBusy || importing
  const activeFilters = Object.entries(FILTER_LABELS).filter(([key]) => filters[key])
  const selectedRows = selected.map(index => cases[index]).filter(Boolean)
  const visibleFields = columns.map(key => CASE_FIELDS.find(f => f.key === key)).filter(Boolean)
  const setFilter = (key, value) => setFilters(current => ({ ...current, [key]: value }))

  useEffect(() => { localStorage.setItem('case-visible-columns', JSON.stringify(columns)) }, [columns])
  useEffect(() => { localStorage.setItem('case-compact', JSON.stringify(compact)) }, [compact])
  useEffect(() => { localStorage.setItem('case-column-widths', JSON.stringify(columnWidths)) }, [columnWidths])

  const startResize = (key, event) => {
    event.preventDefault(); event.stopPropagation()
    resizing.current = { key, startX: event.clientX, startWidth: columnWidths[key] || 140 }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const onMove = e => {
      if (!resizing.current) return
      const next = Math.max(60, resizing.current.startWidth + (e.clientX - resizing.current.startX))
      setColumnWidths(current => ({ ...current, [resizing.current.key]: next }))
    }
    const onUp = () => {
      resizing.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  useEffect(() => {
    getDatabaseInfo().then(setDatabaseInfo).catch(err => setError(err.message))
    const shortcut = event => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') { event.preventDefault(); searchInput.current?.focus() }
    }
    window.addEventListener('keydown', shortcut)
    return () => {
      window.removeEventListener('keydown', shortcut)
    }
  }, [])
  useEffect(() => {
    getDistrictOptions().then(({ data }) => setDistricts((data || []).map(d => d.name)))
    getCaseTypeOptions().then(({ data }) => {
      const seen = new Map()
      for (const t of data || []) {
        if (!t.short_type) continue
        const existing = seen.get(t.short_type)
        const label = t.long_type && t.long_type !== t.short_type ? `${t.short_type} - ${t.long_type}` : t.short_type
        seen.set(t.short_type, { value: t.short_type, label: existing ? `${t.short_type} - (multiple forms)` : label })
      }
      setCaseTypes([...seen.values()].sort((a, b) => a.value.localeCompare(b.value)))
    })
  }, [databaseInfo])

  const load = useCallback(async (pg = 0) => {
    const id = ++request.current
    setLoading(true); setSelected([]); setError('')
    try {
      if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) throw new Error('The start date must be before the end date.')
      const result = await searchCases({ ...filters, page: pg, pageSize })
      if (id !== request.current) return
      if (result.error) throw result.error
      setCases(result.data || []); setTotal(result.count || 0); setPage(pg)
    } catch (err) {
      if (id === request.current) { setCases([]); setTotal(0); setError(err.message || 'Unable to open the local register.'); setPage(0) }
    } finally { if (id === request.current) setLoading(false) }
  }, [filters, pageSize])
  useEffect(() => {
    setLoading(true); setSelected([])
    const timer = setTimeout(() => load(0), 250)
    return () => { clearTimeout(timer); request.current++ }
  }, [load])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 6000)
    return () => clearTimeout(timer)
  }, [notice])

  const handleDatabase = async action => {
    setDatabaseBusy(true); setError('')
    try {
      const result = await (action === 'backup' ? backupDatabase() : restoreDatabase())
      if (!result.canceled) {
        setNotice(action === 'backup' ? `Backup saved: ${result.path}` : `Database restored. Safety backup: ${result.safetyBackup}`)
        setDatabaseInfo(await getDatabaseInfo()); await load(0)
      }
    } catch (err) { setError(err.message) }
    finally { setDatabaseBusy(false) }
  }
  const handleExport = async options => {
    setExporting(true); setExportCount(null)
    try {
      const count = await exportCasesToExcel(filters, (fetched, total) => setExportCount({ fetched, total }), options)
      if (count) { setDialog(''); setNotice(`${number(count)} records exported successfully.`) }
    } catch (err) { setError('Export failed: ' + err.message); setDialog('') }
    finally { setExporting(false); setExportCount(null) }
  }
  const handleDelete = async () => {
    if (!deleteTarget) return
    const result = await deleteCase({ id: deleteTarget.id, RegdNo: deleteTarget.RegdNo, CYear: deleteTarget.CYear })
    setDeleteTarget(null)
    if (result.error) { setError(result.error.message); return }
    getDatabaseInfo().then(setDatabaseInfo); setNotice('Case deleted.'); load(cases.length === 1 ? Math.max(0, page - 1) : page)
  }
  const reset = () => { setFilters({ ...EMPTY_FILTERS }); setSelected([]) }
  const datePreset = days => {
    const now = new Date(), start = new Date()
    if (days === 'year') start.setMonth(0, 1)
    else start.setDate(start.getDate() - days + 1)
    setFilters(f => ({ ...f, dateFrom: format(start, 'yyyy-MM-dd'), dateTo: format(now, 'yyyy-MM-dd') }))
  }
  const sortBy = key => setFilters(f => ({ ...f, sortField: key, sortAsc: f.sortField === key ? !f.sortAsc : key !== 'Dated' }))
  const cell = (row, key) => {
    if (key === 'RegdNo') return <div className="registration"><span>{row.RegdNo}</span><small>{row.CYear || 'Year not recorded'}</small></div>
    if (key === 'Petitioner') return <div className="party-cell"><span className="party-avatar">{String(row.Petitioner || '?').replace(/^(SHRI|SMT|MR|MRS)\.?\s+/i, '').slice(0, 2)}</span><span className="cell-ellipsis">{row.Petitioner || 'Not recorded'}</span></div>
    if (key === 'Type') return <CaseBadge type={row.Type} />
    if (key === 'Dated') return <span className="date-cell">{displayDate(row.Dated)}</span>
    if (key === 'Respondets') return <span className="cell-ellipsis">{splitRespondents(row.Respondets).join('; ') || '—'}</span>
    return <span className="cell-ellipsis">{row[key] ?? '—'}</span>
  }

  return <div className="app-shell">
      <main className="main-content">
        <div className="page-header"><div><h1 className="page-title">Office of the Government Pleader, High Court of Bombay, Bench at Nagpur<span className="title-dot">.</span></h1></div>
          <div className="header-actions">
            {user && <span className="user-pill" title={`Signed in as ${user.username} (${user.role})`}>{user.username} · {user.role}</span>}
            {isAdmin && <button className="btn btn-ghost" title="Users" onClick={() => navigate('/users')}><UsersIcon size={16} />Users</button>}
            {isAdmin && <button className="btn btn-ghost" title="Edit log" onClick={() => navigate('/edit-log')}><History size={16} />Edit log</button>}
            <button className="btn btn-ghost" onClick={() => setDialog('export')} disabled={busy || loading}><Download size={16} />Export</button>
            {isAdmin && <button className="btn btn-ghost" disabled={busy} title="Import Excel or CSV" onClick={() => setDialog('import')}><Upload size={16} />Import</button>}
            {isAdmin && <button className="btn btn-primary" disabled={busy} title="Create a case" onClick={() => { setEditCase(null); setShowForm(true) }}><Plus size={17} />New case</button>}
            {onSignOut && <button className="btn btn-ghost" title="Sign out" onClick={onSignOut}><LogOut size={16} />Sign out</button>}
          </div>
        </div>
        {error && <div className="alert alert-error" role="alert"><CircleHelp size={17} /><span>{error}</span><button aria-label="Dismiss error" className="icon-button" onClick={() => setError('')}><X size={16} /></button></div>}
        {notice && <div className="toast" role="status"><Check size={17} />{notice}<button aria-label="Dismiss notification" className="icon-button" onClick={() => setNotice('')}><X size={15} /></button></div>}

        <section className="register-panel" aria-label="Case records">
          <div className="data-toolbar"><div className="unified-search"><Search size={18} /><input ref={searchInput} className="search-input" aria-label="Search cases" value={filters.query} onChange={e => setFilter('query', e.target.value)} placeholder="Search case records…" /><kbd>Ctrl K</kbd><select aria-label="Search field" value={filters.searchField} onChange={e => setFilter('searchField', e.target.value)}>{SEARCH_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select></div>
            <div className="toolbar-actions"><button className={`btn btn-ghost ${advanced ? 'is-active' : ''}`} aria-expanded={advanced} onClick={() => setAdvanced(v => !v)}><SlidersHorizontal size={15} />Filters{activeFilters.length > 0 && <span className="button-count">{activeFilters.length}</span>}<ChevronDown size={13} style={{ transform: advanced ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} /></button><button className={`btn btn-ghost ${sortOpen ? 'is-active' : ''}`} onClick={() => setSortOpen(v => !v)} aria-expanded={sortOpen}><ArrowUpDown size={15} />Sort</button><button className="btn btn-ghost" onClick={() => setDialog('columns')}><Columns3 size={15} />Columns</button><button className="icon-button refresh-button" aria-label="Refresh records" title="Refresh records" disabled={loading || busy} onClick={() => load(page)}><RefreshCw size={17} /></button></div>
          </div>
          {advanced && <div className="advanced-filters"><div className="advanced-title"><span>Refine your search</span><div><button className="text-button" onClick={() => datePreset(30)}>Last 30 days</button><button className="text-button" onClick={() => datePreset('year')}>This year</button><button className="text-button" onClick={reset}>Reset all</button></div></div><div className="filter-grid">
            <label>District<FilterSelect value={filters.district} onChange={value => setFilter('district', value)} options={districts} placeholder="All districts" /></label>
            <label>Case type<FilterSelect value={filters.caseType} onChange={value => setFilter('caseType', value)} options={caseTypes} placeholder="All case types" minWidth={185} /></label>
            <label>Year<input className="form-input" type="number" placeholder="All years" min="1900" max="2099" value={filters.cyear} onChange={e => setFilter('cyear', e.target.value)} /></label>
            <label>Match mode<select className="form-select" value={filters.matchMode} onChange={e => setFilter('matchMode', e.target.value)}><option value="contains">Contains</option><option value="starts">Starts with</option><option value="exact">Exact match</option></select></label>
            <label>Filed from<input className="form-input" type="date" value={filters.dateFrom} onChange={e => setFilter('dateFrom', e.target.value)} /></label><label>Filed through<input className="form-input" type="date" value={filters.dateTo} onChange={e => setFilter('dateTo', e.target.value)} /></label>
            {[['advocate', 'Advocate contains'], ['respondent', 'Respondent contains'], ['remark', 'Remark contains']].map(([key, label]) => <label key={key}>{label}<input className="form-input" placeholder="Any" value={filters[key]} onChange={e => setFilter(key, e.target.value)} /></label>)}
          </div></div>}
          {sortOpen && <div className="sort-panel"><ArrowUpDown size={17} /><span>Sort by</span><select aria-label="Primary sort" className="form-select" value={filters.sortField} onChange={e => setFilter('sortField', e.target.value)}>{CASE_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select><select aria-label="Primary direction" className="form-select" value={String(filters.sortAsc)} onChange={e => setFilter('sortAsc', e.target.value === 'true')}><option value="true">Ascending</option><option value="false">Descending</option></select><span>then by</span><select aria-label="Secondary sort" className="form-select" value={filters.secondarySort} onChange={e => setFilter('secondarySort', e.target.value)}><option value="">No secondary sort</option>{CASE_FIELDS.filter(f => f.key !== filters.sortField).map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select><select aria-label="Secondary direction" className="form-select" value={String(filters.secondaryAsc)} disabled={!filters.secondarySort} onChange={e => setFilter('secondaryAsc', e.target.value === 'true')}><option value="true">Ascending</option><option value="false">Descending</option></select></div>}
          {activeFilters.length > 0 && <div className="active-filters">{activeFilters.map(([key, label]) => <button key={key} className="filter-chip" onClick={() => setFilter(key, '')}>{label}: {filters[key]}<X size={12} /></button>)}<button className="text-button" onClick={reset}>Clear all</button></div>}
          {selected.length > 0 && <div className="selection-bar"><CheckCheck size={17} /><strong>{selected.length} selected on this page</strong><button className="text-button" disabled={busy} onClick={() => setDialog('export')}><Download size={14} />Export selection</button><button className="text-button" onClick={() => setSelected([])}>Clear selection</button></div>}
          <div className={`table-wrap ${compact ? 'compact' : ''}`} aria-busy={loading}>
            {loading ? <div className="loading-row"><Spinner /><span>Loading case records…</span></div> : !cases.length ? <EmptyState icon={<FolderOpen size={36} />} text={error ? 'Records could not be loaded' : 'No cases match your search'} /> : <table className="resizable-table">
              <colgroup><col style={{ width: 32 }} />{visibleFields.map(field => <col key={field.key} style={{ width: columnWidths[field.key] || 140 }} />)}<col style={{ width: 90 }} /></colgroup>
              <thead><tr><th className="checkbox-cell"><input aria-label="Select all records on this page" type="checkbox" checked={selected.length === cases.length} ref={el => { if (el) el.indeterminate = selected.length > 0 && selected.length < cases.length }} onChange={e => setSelected(e.target.checked ? cases.map((_, index) => index) : [])} /></th>{visibleFields.map(field => <th key={field.key} aria-sort={filters.sortField === field.key ? filters.sortAsc ? 'ascending' : 'descending' : 'none'}><button onClick={() => sortBy(field.key)}>{field.label}{filters.sortField === field.key ? filters.sortAsc ? <ArrowUp size={13} /> : <ArrowDown size={13} /> : <ArrowUpDown size={12} className="sort-idle" />}</button><span className="col-resize-handle" onMouseDown={e => startResize(field.key, e)} onClick={e => e.stopPropagation()} role="separator" aria-label={`Resize ${field.label}`} /></th>)}<th className="actions-heading">Actions</th></tr></thead>
              <tbody>{cases.map((row, index) => <tr key={`${row.RegdNo}-${row.CYear}-${index}`} className={selected.includes(index) ? 'selected-row' : ''} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) setDetailCase(row) }} onClick={() => setDetailCase(row)}><td className="checkbox-cell" onClick={e => e.stopPropagation()}><input aria-label={`Select case ${row.RegdNo}`} type="checkbox" checked={selected.includes(index)} onChange={e => setSelected(current => e.target.checked ? [...current, index] : current.filter(i => i !== index))} /></td>{visibleFields.map(field => <td key={field.key} title={String(row[field.key] ?? '')}>{field.key === 'RegdNo' ? <button className="record-link" onClick={() => setDetailCase(row)} aria-label={`View case ${row.RegdNo}`}>{cell(row, field.key)}</button> : cell(row, field.key)}</td>)}<td className="row-actions" onClick={e => e.stopPropagation()}><button className="icon-button" title="Print" aria-label={`Print case ${row.RegdNo}`} onClick={() => printCase(row)}><Printer size={15} /></button><button className="icon-button" title={isClerk ? `Update case number for ${row.RegdNo}` : `Edit case ${row.RegdNo}`} aria-label={`Edit case ${row.RegdNo}`} disabled={busy} onClick={() => isClerk ? setClerkEditCase(row) : (setEditCase(row), setShowForm(true))}><Pencil size={15} /></button></td></tr>)}</tbody>
            </table>}
          </div>
          <div className="table-footer"><span>{total ? `${number(page * pageSize + 1)}–${number(Math.min((page + 1) * pageSize, total))}` : '0'} of <strong>{number(total)}</strong> records</span><label className="page-size">Rows per page<select aria-label="Rows per page" value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>{[25, 50, 100, 250].map(value => <option key={value}>{value}</option>)}</select></label><Pagination page={page} total={total} pageSize={pageSize} onChange={pg => load(pg)} disabled={loading} /></div>
        </section>
      </main>

    <ExportDialog open={dialog === 'export'} onClose={() => setDialog('')} total={total} pageRows={cases} selectedRows={selectedRows} visibleColumns={columns} onExport={handleExport} busy={exporting} progress={exportCount} />
    {dialog === 'import' && <ImportDialog onClose={() => setDialog('')} onBusyChange={setImporting} onImported={count => { load(0); getDatabaseInfo().then(setDatabaseInfo); setNotice(`${number(count)} cases imported into the local database.`) }} />}
    <Modal open={dialog === 'columns'} onClose={() => setDialog('')} title="Columns" size="570px" footer={<><button className="btn btn-ghost" onClick={() => { const defaults = Object.fromEntries(CASE_FIELDS.map(f => [f.key, f.px || 140])); setColumns(DEFAULT_COLUMNS); setColumnWidths(defaults) }}>Restore defaults</button><button className="btn btn-primary" onClick={() => setDialog('')}><Check size={16} />Done</button></>}><p className="dialog-intro">Tick a column to show it. Drag the right edge of any column header to resize it.</p><div className="column-grid">{CASE_FIELDS.map(field => <label className="check-option" key={field.key}><input type="checkbox" checked={columns.includes(field.key)} disabled={columns.length === 1 && columns.includes(field.key)} onChange={() => setColumns(current => current.includes(field.key) ? current.filter(key => key !== field.key) : [...current, field.key])} />{field.label}</label>)}</div><div className="density-setting"><div><strong>Compact rows</strong><p>Fit more records into your workspace.</p></div><input aria-label="Compact rows" type="checkbox" checked={compact} onChange={e => setCompact(e.target.checked)} /></div></Modal>
    <Modal open={dialog === 'database'} onClose={databaseBusy ? () => {} : () => setDialog('')} title="Backup & restore" size="560px"><p className="dialog-intro">Keep a backup on another drive to protect your records. Restore replaces the register after confirmation and saves a safety copy first.</p><p className="form-hint" style={{ overflowWrap: 'anywhere' }}>Database: {databaseInfo?.path}</p><div className="library-actions"><button className="btn btn-primary" disabled={busy} onClick={() => handleDatabase('backup')}><Download size={16} />Back up database</button><button className="btn btn-ghost" disabled={busy} onClick={() => handleDatabase('restore')}><Upload size={16} />Restore backup</button></div>{databaseBusy && <Spinner />}</Modal>
    <Modal open={dialog === 'help'} onClose={() => setDialog('')} title="Workspace guide" size="520px"><div className="guide-list">{[[Search, 'Find the right case', 'Use Ctrl + K to search, choose a field, then open Filters to narrow by district, type, year or filing dates.'], [Download, 'Export records', 'Select records on a page, or export all matching results. Choose Excel or CSV and the columns you need.'], [HardDrive, 'Work without a connection', 'All records are stored on this computer. Back up the database to another drive from the Backup menu.']].map(([Icon, title, text]) => <div key={title}><Icon size={22} /><section><strong>{title}</strong><p>{text}</p></section></div>)}</div></Modal>
    <CaseForm open={showForm} onClose={() => setShowForm(false)} editCase={editCase} onSaved={() => { load(page); getDatabaseInfo().then(setDatabaseInfo); setNotice(editCase ? 'Case updated.' : 'Case created.') }} />
    <ClerkEditDialog open={!!clerkEditCase} onClose={() => setClerkEditCase(null)} caseData={clerkEditCase} onSaved={() => { load(page); setNotice('Case number updated.') }} />
    <CaseDetail open={!!detailCase} onClose={() => setDetailCase(null)} caseData={detailCase} onDelete={isAdmin ? row => { setDetailCase(null); setDeleteTarget(row) } : null} />
    <DeletePasswordConfirm open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} caseData={deleteTarget} />
  </div>
}
