import { useState, useMemo, useEffect, useRef } from 'react'
import { Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check, AlertTriangle, Download, CheckCheck } from 'lucide-react'
import { Modal, Spinner } from './UI'
import { CASE_FIELDS } from '../utils/caseFields'
import { readCaseWorkbook, suggestMapping, validateImport, checkImportDuplicates, MAX_IMPORT_BYTES } from '../utils/importCases'
import { getExistingImportKeys, insertNewImportCases, getDistrictOptions, getCaseTypeOptions } from '../lib/database'
import { csvCell } from '../utils/exportCases'

const STATUS = { ready: 'New case', existing: 'Already exists', duplicate: 'Duplicate in file', invalid: 'Needs correction' }
const display = value => value?.formula ? '[Formula]' : value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '')

export default function ImportDialog({ onClose, onImported, onBusyChange }) {
  const [fileName, setFileName] = useState('')
  const [sheets, setSheets] = useState([])
  const [sheetIndex, setSheetIndex] = useState(0)
  const [config, setConfig] = useState({ mapping: [], hasHeaders: true, headerRow: 1, dateOrder: 'DMY', respondentSeparator: 'stored' })
  const [step, setStep] = useState('file')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const [review, setReview] = useState(null)
  const [result, setResult] = useState(null)
  const [rowFilter, setRowFilter] = useState('all')
  const [lookups, setLookups] = useState({})
  const fileInput = useRef()
  const alive = useRef(true)
  const sheet = sheets[sheetIndex]
  useEffect(() => {
    alive.current = true
    Promise.all([getDistrictOptions(), getCaseTypeOptions()]).then(([districts, caseTypes]) => {
      if (alive.current) setLookups({ districts: districts.data?.map(d => d.name), caseTypes: caseTypes.data })
    }).catch(() => {})
    return () => { alive.current = false }
  }, [])
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false) }, [busy, onBusyChange])
  const validation = useMemo(() => sheet ? validateImport(sheet, config, lookups) : null, [sheet, config, lookups])
  const previewRows = useMemo(() => review?.rows.filter(row => rowFilter === 'all' || (rowFilter === 'issues' ? row.status !== 'ready' : row.status === rowFilter)) || [], [review, rowFilter])

  const selectSheet = (nextSheets, index, row = 1, headers) => {
    const suggestion = suggestMapping(nextSheets[index].grid, row, headers)
    setSheetIndex(index)
    setConfig(current => ({ ...current, ...suggestion, headerRow: row }))
    setReview(null); setError('')
  }
  const chooseFile = async file => {
    if (!file) return
    setBusy(true); setError(''); setProgress(null)
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('Choose a file smaller than 30 MB.')
      const parsed = await readCaseWorkbook(await file.arrayBuffer(), file.name)
      setSheets(parsed); setFileName(file.name); selectSheet(parsed, 0); setStep('mapping')
    } catch (err) { setError(err.message || 'The file could not be read. Save it as Excel or UTF-8 CSV and try again.') }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = '' }
  }
  const check = async () => {
    setBusy(true); setError(''); setProgress({ phase: 'checking', fetched: 0, total: 0 })
    try {
      const keys = await getExistingImportKeys((fetched, total) => setProgress({ phase: 'checking', fetched, total }))
      setReview(checkImportDuplicates(validation, keys)); setRowFilter('all'); setStep('review')
    } catch (err) { setError(err.message || 'The register could not be checked. No data has been imported.') }
    finally { setBusy(false); setProgress(null) }
  }
  const importRows = async () => {
    setBusy(true); setError('')
    try {
      const outcome = await insertNewImportCases(review.ready, setProgress)
      setResult(outcome); setStep('done')
      if (outcome.imported) onImported(outcome.imported)
    } catch (err) { setError(err.message || 'Import could not start. Please review the file again.') }
    finally { setBusy(false); setProgress(null) }
  }
  const downloadReport = async () => {
    setError('')
    try {
      const rows = [['Sheet row', 'Regd No', 'Year', 'Review status', 'Details'], ...review.rows.map(row => [row.rowNumber, row.data.RegdNo, row.data.CYear, STATUS[row.status], row.errors.join(' ')])]
      const bytes = new TextEncoder().encode('\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')).buffer
      const filename = `cases_import_report_${new Date().toISOString().slice(0, 10)}.csv`
      if (window.desktop?.saveExport) await window.desktop.saveExport(filename, bytes)
      else {
        const url = URL.createObjectURL(new Blob([bytes], { type: 'text/csv;charset=utf-8' }))
        const link = document.createElement('a'); link.href = url; link.download = filename
        document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch (err) { setError('Could not save the review report: ' + err.message) }
  }

  const footer = step === 'done' ? <button className="btn btn-primary" onClick={onClose}>Done</button> : <>
    <button className="btn btn-ghost" disabled={busy} onClick={step === 'review' ? () => { setStep('mapping'); setReview(null) } : step === 'mapping' ? () => { setStep('file'); setError('') } : onClose}>{step === 'file' ? 'Cancel' : <><ArrowLeft size={15} />Back</>}</button>
    {step === 'mapping' && <button className="btn btn-primary" disabled={busy || !!validation?.mappingErrors.length || !validation?.rows.length} onClick={check}>{busy ? <Spinner size={16} /> : <ArrowRight size={16} />}Check & preview</button>}
    {step === 'review' && <button className="btn btn-primary" disabled={busy || !review.ready.length} onClick={importRows}>{busy ? <Spinner size={16} /> : <Upload size={16} />}{busy ? 'Importing…' : `Import ${review.ready.length.toLocaleString()} new cases`}</button>}
  </>
  return <Modal open onClose={busy ? () => {} : onClose} title="Import case records" size="870px" footer={footer}>
    <div className="import-steps">{['Choose file', 'Map columns', 'Review & import'].map((label, index) => <span key={label} className={(step === 'file' ? 0 : step === 'mapping' ? 1 : 2) === index ? 'active' : ''}><b>{index + 1}</b>{label}</span>)}</div>
    {error && <div className="alert alert-error" role="alert"><AlertTriangle size={17} />{error}</div>}
    {step === 'file' && <>
      <p className="dialog-intro">Bring Excel or CSV case records into your register. Review the columns and duplicate check before saving any records.</p>
      <div className="import-dropzone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) chooseFile(e.dataTransfer.files[0]) }}>
        <span className="import-file-icon"><FileSpreadsheet size={32} /></span><strong>Drop your spreadsheet here</strong><span>Excel .xlsx / .xls or UTF-8 CSV · up to 30 MB</span>
        <button className="btn btn-primary" onClick={() => fileInput.current.click()} disabled={busy}>{busy ? <Spinner size={16} /> : <Upload size={16} />}Choose file</button>
        <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" aria-label="Choose import spreadsheet" onChange={e => chooseFile(e.target.files[0])} hidden />
      </div>
      <div className="import-policy"><CheckCheck size={18} /><div><strong>Add new cases. Keep existing records.</strong><p>Existing registration number + year combinations are skipped. Duplicate rows within the file and rows with validation errors are held back for correction.</p></div></div>
    </>}
    {step === 'mapping' && <>
      <div className="import-file-summary"><FileSpreadsheet size={21} /><div><strong>{fileName}</strong><small>{sheet.grid.length.toLocaleString()} sheet rows · {sheets.length} sheet{sheets.length === 1 ? '' : 's'}</small></div></div>
      <fieldset className="plain-fieldset" disabled={busy}>
        <div className="import-options"><label>Worksheet<select className="form-select" value={sheetIndex} onChange={e => selectSheet(sheets, Number(e.target.value))}>{sheets.map((value, index) => <option value={index} key={value.name}>{value.name}</option>)}</select></label>
          <label>First row to read<input className="form-input" type="number" min="1" max={sheet.grid.length} value={config.headerRow} onChange={e => { const row = Number(e.target.value); if (Number.isInteger(row) && row > 0 && row <= sheet.grid.length) selectSheet(sheets, sheetIndex, row) }} /></label>
          <label>Date order<select className="form-select" value={config.dateOrder} onChange={e => setConfig(current => ({ ...current, dateOrder: e.target.value }))}><option value="DMY">Day / Month / Year</option><option value="MDY">Month / Day / Year</option></select></label>
        </div>
        <div className="import-header-option"><label className="check-option"><input type="checkbox" checked={config.hasHeaders} onChange={e => selectSheet(sheets, sheetIndex, config.headerRow, e.target.checked)} />First row contains column headings</label><span>{config.hasHeaders ? 'Headings are not imported.' : 'No headers: the first row is a case record.'}</span></div>
        <p className="form-hint">Map registration number, year and petitioner. Year values may be blank or 0 for unknown. Unmapped columns are ignored.</p>
        <div className="import-mapping-wrap"><table className="import-mapping"><thead><tr><th>Spreadsheet column</th><th>Example value</th><th>Case field</th></tr></thead><tbody>{config.mapping.map((key, index) => <tr key={index}><td><strong>{config.hasHeaders ? display(sheet.grid[config.headerRow - 1]?.[index]) || `Column ${index + 1}` : `Column ${index + 1}`}</strong></td><td><span className="cell-ellipsis">{display(sheet.grid[config.headerRow - 1 + (config.hasHeaders ? 1 : 0)]?.[index]) || '—'}</span></td><td><select className="form-select" aria-label={`Map column ${index + 1}`} value={key} onChange={e => setConfig(current => ({ ...current, mapping: current.mapping.map((field, i) => i === index ? e.target.value : field) }))}><option value="">Do not import</option>{CASE_FIELDS.map(field => <option key={field.key} value={field.key}>{field.label}{['RegdNo', 'CYear', 'Petitioner'].includes(field.key) ? ' *' : ''}</option>)}</select></td></tr>)}</tbody></table></div>
        <label className="respondent-import-option">Multiple respondents<select className="form-select" value={config.respondentSeparator} onChange={e => setConfig(current => ({ ...current, respondentSeparator: e.target.value }))}><option value="stored">Keep original text / legacy . , separator</option><option value="separated">Split at semicolons or line breaks (app exports)</option></select></label>
      </fieldset>
      {validation?.mappingErrors.map(message => <p className="form-error" key={message}>{message}</p>)}
    </>}
    {step === 'review' && <>
      <p className="dialog-intro"><strong>{fileName}</strong> · {sheet.name}. Only valid new cases will be added. Existing records will not be changed.</p>
      <div className="import-counts"><div className="ready"><strong>{review.ready.length.toLocaleString()}</strong><span>New cases</span></div><div><strong>{review.existing.toLocaleString()}</strong><span>Already exist</span></div><div><strong>{review.duplicates.toLocaleString()}</strong><span>Duplicate rows</span></div><div className={review.invalid ? 'invalid' : ''}><strong>{review.invalid.toLocaleString()}</strong><span>Need correction</span></div></div>
      {!review.ready.length && <div className="alert alert-info">There are no new valid cases to import. Check the report for existing records or rows that need correction.</div>}
      <div className="import-review-toolbar"><select className="form-select" aria-label="Filter import preview" value={rowFilter} onChange={e => setRowFilter(e.target.value)}><option value="all">All rows</option><option value="ready">New cases</option><option value="existing">Already in register</option><option value="issues">Skipped / needs correction</option></select><button className="text-button" disabled={busy} onClick={downloadReport}><Download size={15} />Download review report</button></div>
      <div className="import-preview-wrap"><table><thead><tr><th>Sheet row</th><th>Registration / year</th><th>Petitioner</th><th>Review</th></tr></thead><tbody>{previewRows.slice(0, 50).map(row => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>#{row.data.RegdNo}<small className="import-year">{row.data.CYear ?? 'Unknown year'}</small></td><td><span className="cell-ellipsis">{row.data.Petitioner || '—'}</span></td><td><span className={`import-status ${row.status}`}>{STATUS[row.status]}</span>{row.errors.length > 0 && <small className="import-row-error">{row.errors.join(' ')}</small>}</td></tr>)}</tbody></table></div>
      <p className="form-hint">Showing {Math.min(50, previewRows.length)} of {previewRows.length.toLocaleString()} rows in this view. The report includes every reviewed row.{review.blank > 0 ? ` ${review.blank} empty rows ignored.` : ''}</p>
    </>}
    {step === 'done' && <div className="import-done"><span className="import-file-icon">{result.error ? <AlertTriangle size={31} /> : <CheckCheck size={31} />}</span><h3>{result.error ? 'Import stopped' : 'Import complete'}</h3><strong>{result.imported.toLocaleString()} cases saved</strong><p>{result.skipped ? `${result.skipped.toLocaleString()} additional existing records were skipped during the final check. ` : ''}{result.remaining ? `${result.remaining.toLocaleString()} records were not confirmed as saved. ` : ''}</p>{result.error && <div className="alert alert-error" role="alert">{result.error}</div>}<p>Your records are saved in the local database and ready to use.</p></div>}
    {busy && <div className="export-progress" role="status"><Spinner size={16} />{progress?.phase === 'saving' ? `Saving ${progress.imported.toLocaleString()} of ${progress.total.toLocaleString()} new cases…` : progress?.phase === 'checking' ? `Checking existing records${progress.fetched != null ? ` · ${progress.fetched.toLocaleString()} / ${progress.total.toLocaleString()}` : ''}…` : 'Reading spreadsheet…'}</div>}
  </Modal>
}
