export const CASE_FIELDS = [
  { key: 'RegdNo', label: 'Registration no.', exportLabel: 'Regd No', width: 16, px: 110 },
  { key: 'CYear', label: 'Year', width: 8, px: 70 },
  { key: 'Petitioner', label: 'Petitioner', width: 38, px: 240 },
  { key: 'Title', label: 'Title', width: 12, px: 90 },
  { key: 'RespondentNumbers', label: 'Respondent numbers', width: 24, px: 170 },
  { key: 'Type', label: 'Case type', exportLabel: 'Type', width: 24, px: 100 },
  { key: 'Respondets', label: 'Respondents', width: 50, px: 280 },
  { key: 'Adv', label: 'Advocate', width: 28, px: 180 },
  { key: 'Dated', label: 'Date filed', exportLabel: 'Date Filed', width: 14, px: 110 },
  { key: 'District', label: 'District', width: 18, px: 130 },
  { key: 'Copies', label: 'Copies', width: 10, px: 80 },
  { key: 'AdvMoNo', label: 'Advocate mobile', exportLabel: 'Advocate Mobile', width: 18, px: 130 },
  { key: 'RespndentNo', label: 'Copy for respondent', exportLabel: 'Copy For Resp No', width: 20, px: 160 },
  { key: 'LongType', label: 'Long type', exportLabel: 'Long Type', width: 25, px: 180 },
  { key: 'CaseNumber', label: 'Case number', exportLabel: 'Case Number', width: 14, px: 110 },
  { key: 'UpdatedAt', label: 'Last updated', exportLabel: 'Last Updated', width: 20, px: 150 },
  { key: 'Remark', label: 'Remark', width: 40, px: 240 },
]
export const DEFAULT_COLUMNS = ['RegdNo', 'Petitioner', 'Type', 'Adv', 'Dated', 'District']
export const SORT_FIELDS = CASE_FIELDS.map(field => field.key)
export const EMPTY_FILTERS = {
  query: '', searchField: 'Petitioner', matchMode: 'contains', district: '', caseType: '',
  dateFrom: '', dateTo: '', cyear: '', advocate: '', respondent: '', remark: '',
  sortField: 'Dated', sortAsc: false, secondarySort: '', secondaryAsc: true,
}
export function readPreference(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}
