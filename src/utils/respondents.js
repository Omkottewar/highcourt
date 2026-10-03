// tblRegEntry stores all respondents for a case in a single "Respondets" cell,
// joined by ".," (a period immediately followed by a comma, no space).
export function splitRespondents(raw) {
  if (!raw) return []
  return raw
    .split('.,')
    .map(s => s.trim().replace(/\.+$/, '').trim())
    .filter(Boolean)
}

export function respondentNumbers(row) {
  const names=splitRespondents(row.Respondets)
  try { const numbers=JSON.parse(row.RespondentNumbers || '[]'); return names.map((_,i)=>String(numbers[i] || i+1)) }
  catch { return names.map((_,i)=>String(i+1)) }
}
export function caseTitle(row) {
  return row.Title || (row.Type ? String(row.Type).toUpperCase() : '')
}
