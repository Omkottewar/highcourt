// tblRegEntry stores all respondents for a case in a single "Respondets" cell,
// joined by ".," (a period immediately followed by a comma, no space).
export function splitRespondents(raw) {
  if (!raw) return []
  return raw
    .split('.,')
    .map(s => s.trim().replace(/\.+$/, '').trim())
    .filter(Boolean)
}
