const fs = require('node:fs')
const path = require('node:path')
const { DatabaseSync, backup } = require('node:sqlite')
const { randomUUID } = require('node:crypto')
async function saveBackup({ databasePath, destination }) {
  if (!path.isAbsolute(databasePath) || !path.isAbsolute(destination)) throw new Error('Use absolute database and destination paths.')
  if (!fs.existsSync(databasePath)) throw new Error('The case database does not exist. Open the correct CourtDesk edition first.')
  const source = new DatabaseSync(databasePath, { readOnly: true })
  let temporary
  try {
    if (source.prepare('PRAGMA application_id').get().application_id !== 1128549204) throw new Error('The selected file is not a CourtDesk database.')
    fs.mkdirSync(destination, { recursive: true })
    const now = new Date(), pad = n => String(n).padStart(2, '0')
    const stamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
    const filename = path.join(destination, `CourtDesk-${stamp}-${randomUUID().slice(0,8)}.sqlite`)
    temporary = filename + '.partial'
    await backup(source, temporary)
    const check = new DatabaseSync(temporary)
    check.exec('PRAGMA journal_mode=DELETE')
    let count
    try {
      if (check.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('Backup verification failed.')
      count = check.prepare('SELECT count(*) AS count FROM cases').get().count
    } finally { check.close() }
    fs.renameSync(temporary, filename)
    return { filename, count, savedAt: now.toISOString() }
  } finally {
    source.close()
    if (temporary && fs.existsSync(temporary)) fs.unlinkSync(temporary)
  }
}
module.exports = { saveBackup }
if (require.main === module) {
  const configPath = process.env.COURTDESK_BACKUP_CONFIG
  Promise.resolve().then(async () => {
    if (!configPath) throw new Error('Backup configuration is missing.')
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''))
    const result = await saveBackup(config)
    fs.appendFileSync(path.join(path.dirname(configPath), 'backup-log.jsonl'), JSON.stringify({ status: 'ok', ...result }) + '\n')
    console.log(JSON.stringify(result))
  }).catch(error => {
    if (configPath) {
      try { fs.appendFileSync(path.join(path.dirname(configPath), 'backup-log.jsonl'), JSON.stringify({ status: 'failed', at: new Date().toISOString(), error: error.message }) + '\n') } catch {}
    }
    console.error(error.message); process.exitCode = 1
  })
}
