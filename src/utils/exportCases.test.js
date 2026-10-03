import { exportCasesToExcel, csvCell } from './exportCases'
import { searchAllCases } from '../lib/database'
import * as XLSX from 'xlsx'

jest.mock('../lib/database', () => ({ searchAllCases: jest.fn() }))

afterEach(() => { delete window.desktop; jest.restoreAllMocks() })

test('desktop export produces a readable workbook and retains respondent names', async () => {
  searchAllCases.mockResolvedValue([{ RegdNo: 123, CYear: '2025', Respondets: 'First.,Second.', AdvMoNo: '0123456789' }])
  window.desktop = { saveExcel: jest.fn().mockResolvedValue({ canceled: false }) }
  expect(await exportCasesToExcel({})).toBe(1)
  const [filename, bytes] = window.desktop.saveExcel.mock.calls[0]
  expect(filename).toMatch(/^cases_export_.*\.xlsx$/)
  const workbook = XLSX.read(bytes, { type: 'array' })
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Cases)
  expect(rows[0]).toMatchObject({ 'Regd No': 123, Respondents: 'First; Second', 'Advocate Mobile': '0123456789' })
})

test('canceling Save does not report an exported row', async () => {
  searchAllCases.mockResolvedValue([{ RegdNo: 123 }])
  window.desktop = { saveExcel: jest.fn().mockResolvedValue({ canceled: true }) }
  expect(await exportCasesToExcel({})).toBe(0)
})

test('empty results do not create a workbook', async () => {
  searchAllCases.mockResolvedValue([])
  jest.spyOn(window, 'alert').mockImplementation(() => {})
  window.desktop = { saveExcel: jest.fn() }
  expect(await exportCasesToExcel({})).toBe(0)
  expect(window.desktop.saveExcel).not.toHaveBeenCalled()
})

test('selected-row export uses only chosen fields without fetching the full register', async () => {
  searchAllCases.mockClear()
  window.desktop = { saveExport: jest.fn().mockResolvedValue({ canceled: false }) }
  await exportCasesToExcel({}, null, { rows: [{ RegdNo: 99, Petitioner: 'Selected case', Remark: 'Excluded' }], columns: ['RegdNo', 'Petitioner'] })
  expect(searchAllCases).not.toHaveBeenCalled()
  const workbook = XLSX.read(window.desktop.saveExport.mock.calls[0][1], { type: 'array' })
  expect(XLSX.utils.sheet_to_json(workbook.Sheets.Cases)).toEqual([{ 'Regd No': 99, Petitioner: 'Selected case' }])
  expect(workbook.Sheets.Cases['!autofilter']).toBeDefined()
})

test('CSV cells quote delimiters and neutralize spreadsheet formulas', () => {
  expect(csvCell('A, "B"')).toBe('"A, ""B"""')
  expect(csvCell('=SUM(A1)')).toBe('"\'=SUM(A1)"')
  expect(csvCell('  +123')).toBe('"\'  +123"')
  expect(csvCell(-10)).toBe('"-10"')
})

test('rejects an empty export column selection', async () => {
  await expect(exportCasesToExcel({}, null, { columns: [] })).rejects.toThrow('Select at least one column')
})
