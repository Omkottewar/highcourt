import { CASE_FIELDS } from './caseFields'

export const MAX_IMPORT_BYTES = 30 * 1024 * 1024
export const MAX_IMPORT_ROWS = 100000
const legacy15 = ['RegdNo', 'CYear', 'Petitioner', 'Respondets', 'Adv', 'Dated', 'Copies', 'District', 'RespndentNo', 'Type', 'Remark', 'AdvAddress', 'AdvMoNo', 'LongType', '']
const legacy14 = ['RegdNo', 'Petitioner', 'Respondets', 'Adv', 'Dated', 'Copies', 'District', 'RespndentNo', 'Type', 'Remark', 'AdvAddress', 'AdvMoNo', 'LongType', 'CYear']
const aliases = {
  RegdNo: ['regdno', 'registrationnumber', 'registrationno', 'regno', 'caseno', 'casenumber'],
  CYear: ['cyear', 'year', 'caseyear'],
  Petitioner: ['petitioner', 'petitionername', 'applicant'],
  Respondets: ['respondets', 'respondents', 'respondent', 'respondentname'],
  Adv: ['adv', 'advocate', 'advocatename', 'counsel'],
  Dated: ['dated', 'date', 'datefiled', 'filingdate'],
  Copies: ['copies', 'numberofcopies', 'noofcopies'],
  District: ['district', 'districtname'],
  RespndentNo: ['respndentno', 'respondentno', 'copyforrespno', 'copyforrespondent'],
  Type: ['type', 'casetype', 'typeshort'],
  Remark: ['remark', 'remarks', 'notes'],
  AdvAddress: ['advaddress', 'advocateaddress'],
  AdvMoNo: ['advmono', 'advmobile', 'advocatemobile', 'mobilenumber', 'mobile'],
  LongType: ['longtype'],
  CaseNumber: ['casenumber', 'courtcaseno', 'courtcasenumber', 'courtassignedno'],
}
const normalizeHeader = value => String(value ?? '').replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const fieldFor = value => {
  const header = normalizeHeader(value)
  return CASE_FIELDS.find(f => [f.key, f.label, f.exportLabel || '', ...(aliases[f.key] || [])].some(alias => normalizeHeader(alias) === header && header))?.key || ''
}
const clean = value => {
  const text = String(value ?? '').trim()
  return !text || /^null$/i.test(text) ? null : text
}
export const importKey = row => JSON.stringify([String(row.RegdNo), row.CYear == null || row.CYear === '' ? null : String(row.CYear)])

export async function readCaseWorkbook(buffer, filename) {
  if (buffer.byteLength > MAX_IMPORT_BYTES) throw new Error('Choose a file smaller than 30 MB.')
  if (!/\.(xlsx|xls|csv)$/i.test(filename)) throw new Error('Choose an Excel (.xlsx or .xls) or CSV file.')
  const XLSX = await import('xlsx')
  let input = buffer, type = 'array'
  if (/\.csv$/i.test(filename)) {
    const bytes = new Uint8Array(buffer)
    const encoding = bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le' : bytes[0] === 254 && bytes[1] === 255 ? 'utf-16be' : 'utf-8'
    input = new TextDecoder(encoding, { fatal: true }).decode(buffer)
    type = 'string'
  }
  const workbook = XLSX.read(input, { type, raw: true, cellNF: true, cellDates: false, sheetRows: MAX_IMPORT_ROWS + 2 })
  const sheets = workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name]
    if (sheet['!fullref']) {
      const full = XLSX.utils.decode_range(sheet['!fullref'])
      if (full.e.r >= MAX_IMPORT_ROWS + 1) throw new Error('This sheet exceeds 100,000 rows. Split it into smaller files.')
    }
    const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null
    if (range && range.e.c > 99) throw new Error('This sheet has more than 100 columns. Remove unused formatted columns and try again.')
    const grid = range ? XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '', blankrows: true, range: { s: { r: 0, c: 0 }, e: range.e } }) : []
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })]
        if (cell?.f) grid[r][c] = { formula: true }
        // Preserve explicitly formatted identifiers (e.g. phone numbers with leading zeros).
        else if (cell?.t === 'n' && /^0{2,}$/.test(cell.z || '')) grid[r][c] = XLSX.utils.format_cell(cell)
        else if (cell?.t === 'n' && XLSX.SSF.is_date(cell.z || '')) {
          const date = XLSX.SSF.parse_date_code(cell.v, { date1904: !!workbook.Workbook?.WBProps?.date1904 })
          if (date) grid[r][c] = `${String(date.y).padStart(4, '0')}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
        }
      }
    }
    return { name, grid, date1904: !!workbook.Workbook?.WBProps?.date1904 }
  })
  if (!sheets.some(sheet => sheet.grid.some(row => row.some(value => clean(value))))) throw new Error('The workbook has no data rows.')
  return sheets
}

export function suggestMapping(grid, headerRow = 1, hasHeaders) {
  const first = grid[headerRow - 1] || []
  const detected = first.filter(value => fieldFor(value)).length >= 2
  const headers = hasHeaders ?? detected
  let mapping = headers ? first.map(fieldFor) : Array(first.length).fill('')
  if (!headers && /^\d+$/.test(String(first[0] ?? ''))) {
    if (first.length === 15 && /^(\d{1,4}|NULL)?$/i.test(String(first[1]))) mapping = [...legacy15]
    else if (first.length === 14 && typeof first[1] === 'string' && !/^\d+$/.test(first[1])) mapping = [...legacy14]
  }
  return { hasHeaders: headers, mapping }
}

function validDate(year, month, day) {
  if (year < 1900 || year > 2199) throw new Error('Date year must be between 1900 and 2199.')
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('Invalid calendar date.')
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseImportDate(value, order = 'DMY', date1904 = false) {
  if (clean(value) == null) return null
  if (value instanceof Date) return validDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate())
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || (!date1904 && Math.floor(value) === 60)) throw new Error('Invalid Excel date serial.')
    const serial = Math.floor(value)
    const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31)
    const days = date1904 ? serial : serial > 60 ? serial - 1 : serial
    const date = new Date(epoch + days * 86400000)
    return validDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
  }
  const text = String(value).trim()
  let parts = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T]00:00(?::00(?:\.0+)?)?Z?)?$/)
  if (parts) return validDate(+parts[1], +parts[2], +parts[3])
  parts = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (parts) return validDate(+parts[3], +(order === 'DMY' ? parts[2] : parts[1]), +(order === 'DMY' ? parts[1] : parts[2]))
  throw new Error('Use YYYY-MM-DD, a four-digit-year date, or an Excel date cell.')
}

export function validateImport(sheet, config, lookups = {}) {
  const { mapping, hasHeaders, headerRow = 1, dateOrder = 'DMY', respondentSeparator = 'stored' } = config
  const mapped = mapping.filter(Boolean)
  const mappingErrors = []
  for (const key of ['RegdNo', 'CYear', 'Petitioner']) if (!mapped.includes(key)) mappingErrors.push(`Map the ${CASE_FIELDS.find(f => f.key === key).label} column.`)
  if (mapped.length !== new Set(mapped).size) mappingErrors.push('Each case field can only be mapped once.')
  if (mappingErrors.length) return { mappingErrors, rows: [], ready: [], invalid: 0, duplicates: 0, blank: 0 }
  const districts = new Map((lookups.districts || []).map(name => [name.toLowerCase(), name]))
  const types = new Map()
  for (const item of lookups.caseTypes || []) {
    for (const alias of [item.short_type, item.long_type].filter(Boolean)) {
      types.set(alias.toLowerCase(), { short: item.short_type, long: item.long_type || item.short_type })
    }
  }
  const rows = [], keys = new Map()
  let blank = 0
  for (let index = headerRow - 1 + (hasHeaders ? 1 : 0); index < sheet.grid.length; index++) {
    const values = sheet.grid[index]
    if (!values.some(value => clean(value))) { blank++; continue }
    const data = Object.fromEntries(CASE_FIELDS.map(field => [field.key, null]))
    const errors = []
    mapping.forEach((key, column) => {
      if (!key) return
      if (values[column]?.formula) { errors.push(`${key}: paste formula results as values before importing.`); return }
      data[key] = values[column] ?? null
    })
    const registration = String(data.RegdNo ?? '').trim().replace(/,/g, '')
    if (!/^\d+(?:\.0+)?$/.test(registration) || !Number.isSafeInteger(Number(registration)) || Number(registration) <= 0) errors.push('Registration number must be a positive whole number within the safe Excel range.')
    else data.RegdNo = Number(registration)
    for (const field of CASE_FIELDS) if (!['RegdNo', 'Dated'].includes(field.key)) data[field.key] = clean(data[field.key])
    if (!data.Petitioner) errors.push('Petitioner is required.')
    if (data.CYear != null) {
      if (!/^\d{1,4}(?:\.0+)?$/.test(data.CYear)) errors.push('Year must be a whole year, 0 for unknown, or blank.')
      else data.CYear = String(Number(data.CYear))
    }
    try { data.Dated = parseImportDate(data.Dated, dateOrder, sheet.date1904) } catch (err) { errors.push('Date filed: ' + err.message) }
    if (data.District) {
      const match = districts.get(data.District.toLowerCase())
      if (match) data.District = match
      else errors.push(`District "${data.District}" is not in the catalog. Correct the cell or add the district first.`)
    }
    if (data.Type) {
      const match = types.get(data.Type.toLowerCase())
      if (match) { data.Type = match.short; data.LongType = match.long }
      else errors.push(`Case type "${data.Type}" is not in the catalog. Correct the cell or add the type first.`)
    }
    if (data.LongType && /\bNO\.\s*_+/i.test(String(data.LongType))) data.LongType = null
    if (data.CaseNumber) {
      const trimmed = String(data.CaseNumber).trim().replace(/\.0+$/, '')
      if (!/^\d+$/.test(trimmed) || Number(trimmed) <= 0) errors.push('Case number must be a positive whole number.')
      else data.CaseNumber = trimmed
    }
    if (data.Respondets && respondentSeparator === 'separated') data.Respondets = data.Respondets.split(/[;\r\n]+/).map(v => v.trim().replace(/\.+$/, '')).filter(Boolean).join('.,')
    const key = importKey(data)
    const record = { rowNumber: index + 1, data, key, errors, status: errors.length ? 'invalid' : 'ready' }
    rows.push(record)
    if (!keys.has(key)) keys.set(key, [])
    keys.get(key).push(record)
  }
  // Every occurrence of a repeated identity is held back; never arbitrarily pick a winner.
  for (const group of keys.values()) if (group.length > 1) for (const record of group) {
    record.errors.push('Registration number and year repeat within this file. Resolve the duplicate rows before importing.')
    if (record.status === 'ready') record.status = 'duplicate'
  }
  return { mappingErrors, rows, ready: rows.filter(row => row.status === 'ready'),
    invalid: rows.filter(row => row.status === 'invalid').length, duplicates: rows.filter(row => row.status === 'duplicate').length, blank }
}

export function checkImportDuplicates(validation, existingKeys) {
  const rows = validation.rows.map(row => row.status === 'ready' && existingKeys.has(row.key)
    ? { ...row, status: 'existing', errors: ['Already in the register; existing data will be kept.'] } : row)
  return { ...validation, rows, ready: rows.filter(row => row.status === 'ready'), existing: rows.filter(row => row.status === 'existing').length }
}
