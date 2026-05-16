import { searchAllCases } from '../lib/supabase'
import { splitRespondents } from './respondents'

// Lazy-loaded Excel export. xlsx is a ~430 KB dependency, so we only pull it
// in when the user actually clicks Export.
export async function exportCasesToExcel(filters, onProgress) {
  const [rows, XLSX] = await Promise.all([
    searchAllCases(filters, onProgress),
    import('xlsx'),
  ])

  if (rows.length === 0) {
    alert('No cases match the current filters — nothing to export.')
    return 0
  }

  const data = rows.map(c => ({
    'Regd No':            c.RegdNo,
    'Year':               c.CYear,
    'Date Filed':         c.Dated,
    'Type':               c.Type,
    'District':           c.District,
    'Petitioner':         c.Petitioner,
    'Respondents':        splitRespondents(c.Respondets).join('; '),
    'Advocate':           c.Adv,
    'Advocate Mobile':    c.AdvMoNo,
    'Advocate Address':   c.AdvAddress,
    'Copies':             c.Copies,
    'Copy For Resp No':   c.RespndentNo,
    'Long Type':          c.LongType,
    'Remark':             c.Remark,
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  // Reasonable column widths so the file opens already-readable in Excel.
  ws['!cols'] = [
    { wch: 10 }, { wch: 6 },  { wch: 12 }, { wch: 22 }, { wch: 14 },
    { wch: 36 }, { wch: 50 }, { wch: 22 }, { wch: 14 }, { wch: 30 },
    { wch: 7 },  { wch: 12 }, { wch: 22 }, { wch: 30 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Cases')

  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `cases_export_${stamp}.xlsx`)
  return rows.length
}
