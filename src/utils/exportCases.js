import { searchAllCases } from '../lib/database'
import { splitRespondents } from './respondents'
import { CASE_FIELDS } from './caseFields'

export function exportValue(row, key) {
  return key === 'Respondets' ? splitRespondents(row[key]).join('; ') : row[key] ?? ''
}

export function csvCell(value) {
  let text = String(value ?? '')
  if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = "'" + text
  return '"' + text.replace(/"/g, '""') + '"'
}

export async function exportCasesToExcel(filters, onProgress, options = {}) {
  const format = options.format === 'csv' ? 'csv' : 'xlsx'
  const fields = options.columns
    ? options.columns.map(key => CASE_FIELDS.find(field => field.key === key)).filter(Boolean)
    : CASE_FIELDS
  if (!fields.length) throw new Error('Select at least one column to export.')
  const rows = options.rows ?? await searchAllCases(filters, onProgress)
  if (!rows.length) {
    alert('No cases match the current filters — nothing to export.')
    return 0
  }
  const filename = `cases_export_${new Date().toISOString().slice(0, 10)}.${format}`
  let bytes, workbook, XLSX
  if (format === 'csv') {
    const lines = [fields.map(f => csvCell(f.exportLabel || f.label)).join(','),
      ...rows.map(row => fields.map(f => csvCell(exportValue(row, f.key))).join(','))]
    bytes = new TextEncoder().encode('\uFEFF' + lines.join('\r\n')).buffer
  } else {
    XLSX = await import('xlsx')
    const data = rows.map(row => Object.fromEntries(fields.map(f => [f.exportLabel || f.label, exportValue(row, f.key)])))
    const sheet = XLSX.utils.json_to_sheet(data)
    sheet['!cols'] = fields.map(f => ({ wch: f.width }))
    sheet['!autofilter'] = { ref: sheet['!ref'] }
    workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Cases')
    bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  }
  const save = window.desktop?.saveExport || window.desktop?.saveExcel
  if (save) {
    const result = await save(filename, bytes)
    if (result.canceled) return 0
  } else if (format === 'xlsx') {
    XLSX.writeFile(workbook, filename)
  } else {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url; link.download = filename
    document.body.appendChild(link); link.click(); link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return rows.length
}
