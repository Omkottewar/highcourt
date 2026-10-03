const fs = require('node:fs')
const path = require('node:path')

const raw = fs.readFileSync(path.join(__dirname, 'advocate-source.txt'), 'utf8')
const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

const entries = []
let pending = null

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  const start = line.match(/^(\d{1,5})\s+(.+)$/)
  if (!start) {
    if (pending) {
      const mobile = line.match(/^(\d{10,})$/)
      if (mobile) {
        pending.mo_no = mobile[1]
        entries.push(pending)
        pending = null
      } else {
        pending.name = (pending.name + ' ' + line).replace(/\s+/g, ' ').trim()
      }
    }
    continue
  }
  if (pending) {
    entries.push(pending)
    pending = null
  }
  const [, code, rest] = start
  const mobileMatch = rest.match(/\s(\d{9,}|0)\s*$/)
  if (mobileMatch) {
    const name = rest.slice(0, mobileMatch.index).trim()
    const mo_no = mobileMatch[1] === '0' ? null : mobileMatch[1]
    entries.push({ code, name, mo_no })
  } else {
    pending = { code, name: rest.trim(), mo_no: null }
  }
}
if (pending) entries.push(pending)

const cleaned = entries
  .map(e => ({
    code: String(e.code).trim(),
    name: String(e.name || '').replace(/\s+/g, ' ').replace(/\s*\(.*?\)\s*/g, ' ').trim().toUpperCase(),
    mo_no: e.mo_no && /^\d{10,}$/.test(e.mo_no) ? e.mo_no : null,
  }))
  .filter(e => e.name && e.name.length >= 2)

const byName = new Map()
for (const e of cleaned) {
  const key = e.name
  const existing = byName.get(key)
  if (!existing) byName.set(key, e)
  else if (!existing.mo_no && e.mo_no) byName.set(key, e)
}

const output = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true })
fs.writeFileSync(path.join(__dirname, '..', 'data', 'advocates.json'), JSON.stringify(output, null, 2))
console.log(`Parsed ${output.length} unique advocates from ${entries.length} raw entries`)
