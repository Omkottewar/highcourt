#!/usr/bin/env node
// Normalizes polluted Type/District/LongType/AdvAddress values in a CourtDesk SQLite register.
// Usage: node scripts/cleanup-register.cjs [path/to/register.sqlite]
// A timestamped backup is written next to the source before any update.

const fs = require('node:fs')
const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')
const catalog = require('../desktop/catalog.json')

const target = path.resolve(process.argv[2] || path.join(__dirname, '..', 'data', 'initial-register.sqlite'))
if (!fs.existsSync(target)) { console.error(`Register not found: ${target}`); process.exit(1) }

const backup = target.replace(/\.sqlite$/i, '') + `.before-cleanup-${Date.now()}.sqlite`
fs.copyFileSync(target, backup)
console.log(`Backup written: ${backup}`)

const db = new DatabaseSync(target)
db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;')

const shortToLongs = new Map()
const longToShort = new Map()
for (const entry of catalog.types) {
  const short = String(entry.short_type || '').trim()
  const long = String(entry.long_type || '').trim()
  if (!short) continue
  if (!shortToLongs.has(short)) shortToLongs.set(short, new Set())
  if (long) shortToLongs.get(short).add(long)
  if (long) longToShort.set(long.toLowerCase(), short)
}

const hasMasters = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='masters'").get()
const masterTypes = hasMasters ? db.prepare("SELECT code, name FROM masters WHERE kind='type'").all() : []
for (const row of masterTypes) {
  const short = String(row.code || '').trim()
  const long = String(row.name || '').trim()
  if (!short) continue
  if (!shortToLongs.has(short)) shortToLongs.set(short, new Set())
  if (long) shortToLongs.get(short).add(long)
  if (long) longToShort.set(long.toLowerCase(), short)
}

const validDistricts = new Set(catalog.districts.map(d => d.toLowerCase()))

function canonicalType(rawType, rawLong) {
  const type = String(rawType || '').trim()
  const long = String(rawLong || '').trim()
  if (!type && !long) return { Type: null, LongType: null }
  if (type) {
    if (shortToLongs.has(type.toUpperCase())) {
      const shortCode = type.toUpperCase()
      const longs = shortToLongs.get(shortCode)
      if (long && longs.has(long)) return { Type: shortCode, LongType: long }
      if (longs.size === 1) return { Type: shortCode, LongType: [...longs][0] || null }
      return { Type: shortCode, LongType: null }
    }
    const asShort = longToShort.get(type.toLowerCase())
    if (asShort) return { Type: asShort, LongType: shortToLongs.get(asShort)?.size === 1 ? [...shortToLongs.get(asShort)][0] : type }
  }
  if (long) {
    const asShort = longToShort.get(long.toLowerCase())
    if (asShort) return { Type: asShort, LongType: long }
  }
  return { Type: null, LongType: null }
}

const rows = db.prepare('SELECT id, Type, LongType, District, AdvAddress FROM cases').all()
const update = db.prepare('UPDATE cases SET Type=?, LongType=?, District=?, AdvAddress=NULL WHERE id=?')

let typeChanged = 0, districtNulled = 0, longTypeClobbered = 0, advAddressNulled = 0

db.exec('BEGIN IMMEDIATE')
try {
  for (const row of rows) {
    const originalType = row.Type
    const originalLong = row.LongType
    const originalDistrict = row.District

    let longForCleanup = originalLong
    if (longForCleanup && /\bNO\.\s*_+/i.test(longForCleanup)) {
      longForCleanup = null
      longTypeClobbered++
    }

    const canonical = canonicalType(originalType, longForCleanup)
    let district = originalDistrict ? String(originalDistrict).trim() : null
    if (district && !validDistricts.has(district.toLowerCase())) {
      district = null
      districtNulled++
    }

    const typeChangeDetected = (canonical.Type || null) !== (originalType || null) || (canonical.LongType || null) !== (originalLong || null)
    if (typeChangeDetected) typeChanged++
    if (row.AdvAddress) advAddressNulled++

    update.run(canonical.Type, canonical.LongType, district, row.id)
  }
  db.exec('COMMIT')
} catch (error) {
  db.exec('ROLLBACK')
  throw error
}

const hasMetadata = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='metadata'").get()
if (hasMetadata) db.prepare("INSERT OR REPLACE INTO metadata VALUES ('updatedAt',?)").run(new Date().toISOString())
db.close()

console.log(JSON.stringify({
  target,
  backup,
  totalRows: rows.length,
  typeNormalized: typeChanged,
  longTypeClobberedCleared: longTypeClobbered,
  districtNulled,
  advAddressNulled,
}, null, 2))
