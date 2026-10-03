import * as XLSX from 'xlsx'
import { TextDecoder, TextEncoder } from 'util'
import { readCaseWorkbook, suggestMapping, validateImport, parseImportDate, importKey, checkImportDuplicates } from './importCases'

global.TextDecoder = TextDecoder
const sheet = grid => ({ grid, name: 'Cases', date1904: false })
const defaultLookups = { districts: ['Nagpur'], caseTypes: [{ short_type: 'WP', long_type: 'Writ Petition' }] }
const validate = (grid, lookups = defaultLookups) => validateImport(sheet(grid), suggestMapping(grid), lookups)

test('headerless legacy file retains the first record and ignores its source-table column', () => {
  const grid = [[1, '2025', 'First petitioner', 'State', 'Counsel', '2025-01-02', '2', 'Nagpur', '1', 'WP', '', '', '0123456789', '', 'tblRegEntry']]
  const config = suggestMapping(grid)
  expect(config.hasHeaders).toBe(false)
  const result = validateImport(sheet(grid), config, defaultLookups)
  expect(result.ready).toHaveLength(1)
  expect(result.ready[0].data).toMatchObject({ RegdNo: 1, Petitioner: 'First petitioner', CYear: '2025', AdvMoNo: '0123456789' })
  expect(result.ready[0].data.source_table).toBeUndefined()
})

test('recognizes app export and legacy retry-file headings', () => {
  expect(suggestMapping([['Regd No', 'Year', 'Petitioner', 'Date Filed', 'Advocate Mobile']]).mapping)
    .toEqual(['RegdNo', 'CYear', 'Petitioner', 'Dated', 'AdvMoNo'])
  expect(suggestMapping([['regd_no', 'cyear', 'petitioner', 'respondents', 'type_short', '_error']]).mapping)
    .toEqual(['RegdNo', 'CYear', 'Petitioner', 'Respondets', 'Type', ''])
})

test('requires identity mappings and rejects duplicate field assignments', () => {
  expect(validate([['raw_value', 'canonical_name'], ['ABC', 'Nagpur']]).mappingErrors).toHaveLength(3)
  expect(validateImport(sheet([[1, 2025, 'Alice', 'Bob']]), { hasHeaders: false, mapping: ['RegdNo', 'CYear', 'Petitioner', 'Petitioner'] }).mappingErrors)
    .toContain('Each case field can only be mapped once.')
})

test('all colliding file identities are held back, invalid dates and names are reported', () => {
  const result = validate([
    ['Regd No', 'Year', 'Petitioner', 'Date Filed'],
    [1, 2025, 'First', '2025-01-01'], [1, 2025, 'Different', '2025-01-02'],
    [2, 2025, 'NULL', '2025-01-02'], [3, 2025, 'Valid name', '31/02/2025'],
    [4, 0, 'Unknown year', ''], [5, '', 'No year', ''],
  ])
  expect(result.duplicates).toBe(2)
  expect(result.invalid).toBe(2)
  expect(result.ready.map(row => row.data.CYear)).toEqual(['0', null])
})

test('date conversion supports ISO, day-first, month-first and both Excel epochs', () => {
  expect(parseImportDate('03/04/2025', 'DMY')).toBe('2025-04-03')
  expect(parseImportDate('03/04/2025', 'MDY')).toBe('2025-03-04')
  expect(parseImportDate('2025-04-03 00:00:00')).toBe('2025-04-03')
  expect(parseImportDate(1)).toBe('1900-01-01')
  expect(parseImportDate(0, 'DMY', true)).toBe('1904-01-01')
  expect(() => parseImportDate(60)).toThrow('Invalid Excel date serial')
  expect(() => parseImportDate('29/02/2025')).toThrow('Invalid calendar date')
})

test('flags formulas and unsafe numeric registrations; ignores wholly empty rows', () => {
  const result = validate([['RegdNo', 'CYear', 'Petitioner'], [1, 2025, { formula: true }], [Number.MAX_SAFE_INTEGER + 1, 2025, 'Alice'], ['', '', '']])
  expect(result.invalid).toBe(2)
  expect(result.blank).toBe(1)
  expect(result.ready).toHaveLength(0)
})

test('duplicate checks distinguish year and null identity without changing input records', () => {
  const result = validate([['RegdNo', 'CYear', 'Petitioner'], [1, 2025, 'A'], [1, 2024, 'B'], [2, '', 'C']])
  const checked = checkImportDuplicates(result, new Set([importKey({ RegdNo: 1, CYear: '2025' }), importKey({ RegdNo: 2, CYear: null })]))
  expect(checked.existing).toBe(2)
  expect(checked.ready.map(row => row.data.Petitioner)).toEqual(['B'])
  expect(result.ready).toHaveLength(3)
})

test.each(['xlsx', 'xls'])('reads real %s sheets, preserves formatted phones and converts dates', async extension => {
  const workbook = XLSX.utils.book_new()
  const data = XLSX.utils.aoa_to_sheet([['RegdNo', 'CYear', 'Petitioner', 'Dated', 'AdvMoNo'], [7, '2025', 'Sample', 45658, 123456789]])
  data.D2.z = 'yyyy-mm-dd'; data.E2.z = '0000000000'
  XLSX.utils.book_append_sheet(workbook, data, 'Cases')
  const buffer = XLSX.write(workbook, { type: 'array', bookType: extension === 'xls' ? 'biff8' : 'xlsx' })
  const parsed = await readCaseWorkbook(buffer, `cases.${extension}`)
  expect(parsed[0].grid[1][4]).toBe('0123456789')
  expect(validateImport(parsed[0], suggestMapping(parsed[0].grid)).ready[0].data.Dated).toBe('2025-01-01')
})

test('CSV preserves Unicode, quoted commas and zero-prefixed mobile numbers', async () => {
  const buffer = new TextEncoder().encode('RegdNo,CYear,Petitioner,AdvMoNo\n8,2025,"नागपूर, example",0123456789').buffer
  const parsed = await readCaseWorkbook(buffer, 'cases.csv')
  const result = validateImport(parsed[0], suggestMapping(parsed[0].grid))
  expect(result.ready[0].data).toMatchObject({ Petitioner: 'नागपूर, example', AdvMoNo: '0123456789' })
})

test('mapping can start below a title row and normalize known district/type names', () => {
  const grid = [['Office report'], ['RegdNo', 'CYear', 'Petitioner', 'District', 'Type', 'Respondents'], [9, 2025, 'Alice', 'NAGPUR', 'WP', 'First; Second']]
  const config = { ...suggestMapping(grid, 2), headerRow: 2, respondentSeparator: 'separated' }
  const result = validateImport(sheet(grid), config, { districts: ['Nagpur'], caseTypes: [{ short_type: 'WP', long_type: 'Writ Petition' }] })
  expect(result.ready[0]).toMatchObject({ rowNumber: 3, data: { District: 'Nagpur', Type: 'WP', LongType: 'Writ Petition', Respondets: 'First.,Second' } })
})

test('unknown type and district rows are held for review rather than silently written through', () => {
  const grid = [['RegdNo', 'CYear', 'Petitioner', 'District', 'Type'], [1, 2025, 'Alice', 'Atlantis', 'CONT. PETN. IN W. P. NO. 2285/2015']]
  const result = validateImport(sheet(grid), suggestMapping(grid), { districts: ['Nagpur'], caseTypes: [{ short_type: 'WP', long_type: 'Writ Petition' }] })
  expect(result.ready).toHaveLength(0)
  expect(result.invalid).toBe(1)
  expect(result.rows[0].errors.join(' ')).toMatch(/District .* not in the catalog/)
  expect(result.rows[0].errors.join(' ')).toMatch(/Case type .* not in the catalog/)
})

test('clears PDF-template junk previously stored in LongType during import', () => {
  const grid = [['RegdNo', 'CYear', 'Petitioner', 'Type', 'LongType'], [1, 2025, 'Alice', 'WP', 'WP NO. ________/20']]
  const result = validateImport(sheet(grid), suggestMapping(grid), { districts: [], caseTypes: [{ short_type: 'WP', long_type: 'Writ Petition' }] })
  expect(result.ready[0].data).toMatchObject({ Type: 'WP', LongType: 'Writ Petition' })
})
