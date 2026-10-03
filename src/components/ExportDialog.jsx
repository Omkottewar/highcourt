import { useState, useEffect } from 'react'
import { Download, FileSpreadsheet, FileText, Check, Columns3 } from 'lucide-react'
import { Modal, Spinner } from './UI'
import { CASE_FIELDS } from '../utils/caseFields'

export default function ExportDialog({ open, onClose, total, pageRows, selectedRows, visibleColumns, onExport, busy, progress }) {
  const [format, setFormat] = useState('xlsx')
  const [scope, setScope] = useState('matching')
  const [columns, setColumns] = useState(CASE_FIELDS.map(f => f.key))
  useEffect(() => { if (open) setScope(selectedRows.length ? 'selected' : 'matching') }, [open])
  const count = scope === 'matching' ? total : scope === 'page' ? pageRows.length : selectedRows.length
  return <Modal open={open} onClose={busy ? () => {} : onClose} title="Export case records" size="680px" footer={<>
    <span className="modal-footer-note">{count.toLocaleString()} records · {columns.length} columns</span>
    <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
    <button className="btn btn-primary" disabled={busy || !count || !columns.length}
      onClick={() => onExport({ format, columns, rows: scope === 'matching' ? undefined : scope === 'page' ? pageRows : selectedRows })}>
      {busy ? <Spinner size={16} /> : <Download size={16} />}{busy ? 'Preparing file…' : 'Export records'}
    </button>
  </>}>
    <p className="dialog-intro">Choose exactly what goes into your report. Your current filters and sort order are preserved.</p>
    <fieldset disabled={busy} className="plain-fieldset">
      <label className="form-label">File format</label>
      <div className="format-options">
        {[['xlsx', 'Excel workbook', 'Formatted columns · .xlsx', FileSpreadsheet], ['csv', 'CSV file', 'Universal data format · .csv', FileText]].map(([value, title, sub, Icon]) =>
          <button key={value} className={`format-option ${format === value ? 'chosen' : ''}`} onClick={() => setFormat(value)} aria-pressed={format === value}>
            <Icon size={24} /><span><strong>{title}</strong><small>{sub}</small></span>{format === value && <Check size={17} />}
          </button>)}
      </div>
      <label className="form-label" htmlFor="export-scope">Records to include</label>
      <select id="export-scope" className="form-select" value={scope} onChange={e => setScope(e.target.value)}>
        <option value="matching">All matching records ({total.toLocaleString()})</option>
        <option value="page">Current page ({pageRows.length})</option>
        <option value="selected">Selected records on this page ({selectedRows.length})</option>
      </select>
      <div className="section-label"><span><Columns3 size={15} /> Export columns</span><div>
        <button className="text-button" onClick={() => setColumns(CASE_FIELDS.map(f => f.key))}>All columns</button>
        <button className="text-button" onClick={() => setColumns(visibleColumns)}>Visible columns</button>
      </div></div>
      <div className="column-grid">{CASE_FIELDS.map(field => <label key={field.key} className="check-option">
        <input type="checkbox" checked={columns.includes(field.key)} onChange={() => setColumns(current => current.includes(field.key) ? current.filter(key => key !== field.key) : [...current, field.key])} />{field.label}
      </label>)}</div>
    </fieldset>
    {busy && <div className="export-progress" role="status"><Spinner size={16} />{progress ? `${progress.fetched.toLocaleString()} of ${progress.total.toLocaleString()} records prepared` : 'Preparing your download…'}</div>}
  </Modal>
}
