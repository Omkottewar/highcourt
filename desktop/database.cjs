const { DatabaseSync } = require('node:sqlite')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const catalog = require('./catalog.json')
const FIELDS = ['RegdNo','CYear','Petitioner','Respondets','Adv','Dated','Copies','District','RespndentNo','Type','Remark','AdvAddress','AdvMoNo','LongType','Title','RespondentNumbers','PdfName','CaseNumber','CreatedAt','UpdatedAt']
const columns = FIELDS.map(f => `"${f}"`).join(',')
const APP_ID = 1128549204
function normalize(data) {
  if (!data || !Number.isSafeInteger(Number(data.RegdNo)) || Number(data.RegdNo) <= 0) throw new Error('Registration number must be a positive whole number.')
  const row = Object.fromEntries(FIELDS.map(f => [f, data[f] == null || String(data[f]).trim() === '' ? null : String(data[f]).trim()]))
  row.RegdNo = Number(data.RegdNo)
  if (!row.Petitioner || /^null$/i.test(row.Petitioner)) throw new Error('Petitioner name is required.')
  if (row.CYear && !/^(0|\d{4})$/.test(row.CYear)) throw new Error('Enter a four-digit year, or leave it blank.')
  if (row.Dated && (!/^\d{4}-\d{2}-\d{2}$/.test(row.Dated) || !Number.isFinite(Date.parse(row.Dated)) || new Date(row.Dated).toISOString().slice(0,10) !== row.Dated)) throw new Error('Enter a valid filing date.')
  if (row.CaseNumber && (!/^\d+$/.test(row.CaseNumber) || Number(row.CaseNumber) <= 0)) throw new Error('Case number must be a positive whole number.')
  if (FIELDS.some(f => String(row[f] ?? '').length > 200000)) throw new Error('A case field is too long.')
  return row
}
function openRegister(filename) {
  fs.mkdirSync(path.dirname(filename), { recursive: true })
  const db = new DatabaseSync(filename)
  db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA trusted_schema=OFF;')
  const appId = db.prepare('PRAGMA application_id').get().application_id
  if (appId && appId !== APP_ID) { db.close(); throw new Error('This file is not a CourtDesk database.') }
  db.exec(`CREATE TABLE IF NOT EXISTS cases (id INTEGER PRIMARY KEY AUTOINCREMENT, RegdNo INTEGER NOT NULL CHECK(RegdNo>0), CYear TEXT, ${FIELDS.slice(2).map(f => `"${f}" TEXT`).join(',')});
    CREATE UNIQUE INDEX IF NOT EXISTS case_identity ON cases(RegdNo, COALESCE(CYear,''));
    CREATE INDEX IF NOT EXISTS case_date ON cases(Dated,RegdNo,CYear);
    CREATE INDEX IF NOT EXISTS case_district ON cases(District);
    CREATE INDEX IF NOT EXISTS case_type ON cases(Type);
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT);
    PRAGMA application_id=${APP_ID}; PRAGMA user_version=2;`)
  const existingColumns = new Set(db.prepare('PRAGMA table_info(cases)').all().map(c => c.name))
  for (const field of FIELDS) if (!existingColumns.has(field)) db.exec(`ALTER TABLE cases ADD COLUMN "${field}" TEXT`)
  db.exec(`CREATE TABLE IF NOT EXISTS masters (kind TEXT, code TEXT, name TEXT, PRIMARY KEY(kind,code,name));
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','clerk')),
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      created_by TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      last_seen TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS edit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      case_id INTEGER,
      case_regd_no INTEGER,
      case_year TEXT,
      changes TEXT,
      timestamp TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS edit_log_time ON edit_log(timestamp DESC);
    CREATE INDEX IF NOT EXISTS edit_log_user ON edit_log(user_id);`)
  const masterCols = new Set(db.prepare('PRAGMA table_info(masters)').all().map(c => c.name))
  if (!masterCols.has('mo_no')) db.exec('ALTER TABLE masters ADD COLUMN mo_no TEXT')
  const addMaster = ({kind, code='', name='', mo_no=''}) => {
    code=String(code).trim().toUpperCase(); name=String(name).trim(); mo_no=String(mo_no).trim()
    if (!['title','type','advocate'].includes(kind) || !(kind==='title'?code:name) || (kind==='type'&&!code)) throw new Error('Enter the required name and short code.')
    db.prepare('INSERT OR IGNORE INTO masters (kind, code, name, mo_no) VALUES (?,?,?,?)').run(kind,code,name,mo_no || null)
    return {code,name,mo_no}
  }
  for (const code of catalog.titles) addMaster({kind:'title',code})
  for (const item of catalog.types) addMaster({kind:'type',code:item.short_type,name:item.long_type})
  try {
    const advocatesPath = fs.existsSync(path.join(__dirname,'..','data','advocates.json'))
      ? path.join(__dirname,'..','data','advocates.json')
      : path.join(process.resourcesPath || '', 'advocates.json')
    if (fs.existsSync(advocatesPath)) {
      for (const adv of require(advocatesPath)) addMaster({kind:'advocate',code:adv.code || '',name:adv.name,mo_no:adv.mo_no || ''})
    }
  } catch {}

  const pdfsDir = path.join(path.dirname(filename), 'pdfs')
  fs.mkdirSync(pdfsDir, { recursive: true })
  const pdfPath = id => path.join(pdfsDir, `${id}.pdf`)
  function writePdfAtomic(id, bytes) {
    const target = pdfPath(id)
    const tmp = target + '.' + crypto.randomUUID() + '.tmp'
    try { fs.writeFileSync(tmp, bytes); fs.renameSync(tmp, target) }
    finally { try { fs.unlinkSync(tmp) } catch {} }
  }
  // Legacy migration: if an attachments table exists with rows (older DB or legacy backup
  // just restored), move each BLOB to disk and drop the table so the live DB stays small.
  const hasAttachments = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='attachments'").get()
  if (hasAttachments) {
    for (const row of db.prepare('SELECT case_id, bytes FROM attachments').all()) {
      if (!fs.existsSync(pdfPath(row.case_id))) writePdfAtomic(row.case_id, row.bytes)
    }
    db.exec('DROP TABLE attachments')
  }

  function validatePdf(data) {
    if (data.PdfBytes == null) return null
    const bytes = Buffer.from(data.PdfBytes)
    if (bytes.length > 50*1024*1024 || bytes.subarray(0,5).toString() !== '%PDF-' || !data.PdfName) throw new Error('Choose a valid PDF up to 50 MB.')
    return bytes
  }
  function saveAttachment(id, data) {
    const bytes = validatePdf(data)
    if (bytes) writePdfAtomic(id, bytes)
  }
  function removeAttachment(id) {
    try { fs.unlinkSync(pdfPath(id)) } catch {}
  }

  const insert = db.prepare(`INSERT INTO cases (${columns}) VALUES (${FIELDS.map(()=>'?').join(',')})`)
  const insertSkip = db.prepare(`INSERT INTO cases (${columns}) VALUES (${FIELDS.map(()=>'?').join(',')}) ON CONFLICT DO NOTHING`)
  const values = row => FIELDS.map(f => row[f])
  const transaction = fn => { db.exec('BEGIN IMMEDIATE'); try { const result=fn(); db.exec('COMMIT'); return result } catch(error) { db.exec('ROLLBACK'); throw error } }
  const touch = () => db.prepare("INSERT OR REPLACE INTO metadata VALUES ('updatedAt',?)").run(new Date().toISOString())
  const whereKey = key => {
    if (Number.isSafeInteger(key?.id) && key.id > 0) return ['id=?',[key.id]]
    if (!Number.isSafeInteger(Number(key?.RegdNo))) throw new Error('Invalid case identity.')
    return ["RegdNo=? AND COALESCE(CYear,'')=?",[Number(key.RegdNo),String(key.CYear ?? '')]]
  }
  function search(filters={}, all=false) {
    const clauses=[], args=[]
    const add=(sql,...params)=>{clauses.push(sql); args.push(...params)}
    const field = FIELDS.includes(filters.searchField) ? filters.searchField : 'Petitioner'
    const query = String(filters.query || '').trim()
    const match = (field, value, mode) => {
      const escaped=value.replace(/[\\%_]/g,'\\$&')
      add(`CAST("${field}" AS TEXT) LIKE ? ESCAPE '\\'`,mode==='exact'?escaped:mode==='starts'?escaped+'%':'%'+escaped+'%')
    }
    if(query) {
      if(field==='RegdNo') {
        if(!/^\d+$/.test(query)) add('0=1')
        else if(filters.matchMode==='exact') add('RegdNo=?',Number(query))
        else match(field,String(Number(query)),'starts')
      } else match(field,query,filters.matchMode)
    }
    for(const [field,key] of [['District','district'],['Type','caseType'],['CYear','cyear']]) if(filters[key]) add(`"${field}"=?`,String(filters[key]))
    if(filters.dateFrom) add('Dated>=?',String(filters.dateFrom))
    if(filters.dateTo) add('Dated<=?',String(filters.dateTo))
    for(const [field,key] of [['Adv','advocate'],['Respondets','respondent'],['Remark','remark']]) if(filters[key]?.trim()) match(field,filters[key].trim(),'contains')
    const primary=FIELDS.includes(filters.sortField)?filters.sortField:'Dated'
    const secondary=FIELDS.includes(filters.secondarySort)?filters.secondarySort:null
    const order=[...new Set([primary,secondary,'RegdNo','CYear','id'].filter(Boolean))].map(f=>`"${f}" IS NULL ASC, "${f}" ${f==='RegdNo'||f==='id'?'':'COLLATE NOCASE '}${(f===primary?filters.sortAsc:f===secondary?filters.secondaryAsc!==false:true)?'ASC':'DESC'}`).join(',')
    const where=clauses.length?' WHERE '+clauses.join(' AND '):''
    const count=db.prepare('SELECT count(*) AS count FROM cases'+where).get(...args).count
    let sql=`SELECT id,${columns} FROM cases${where} ORDER BY ${order}`
    if(!all) { const size=Math.max(1,Math.min(1000,Number(filters.pageSize)||50)); const page=Math.max(0,Math.floor(Number(filters.page)||0)); sql+=' LIMIT ? OFFSET ?'; args.push(size,page*size) }
    return {data:db.prepare(sql).all(...args),count}
  }
  const info=()=>({path:filename,count:db.prepare('SELECT count(*) AS n FROM cases').get().n,updatedAt:db.prepare("SELECT value FROM metadata WHERE key='updatedAt'").get()?.value || null,pdfsDir})
  function importRows(rows) {
    if(!Array.isArray(rows)||rows.length>100000) throw new Error('Import at most 100,000 rows at a time.')
    const now=new Date().toISOString()
    return transaction(()=>{let imported=0; for(const data of rows) imported+=insertSkip.run(...values(normalize({...data,UpdatedAt:now}))).changes; if(imported)touch(); return {imported,skipped:rows.length-imported,remaining:0}})
  }
  // Backup: VACUUM INTO a copy, then materialize PDFs from disk into a transient
  // attachments table in that copy so a backup file is still self-contained.
  function backup(destination) {
    if (path.resolve(destination).toLowerCase() === path.resolve(filename).toLowerCase()) throw new Error('Choose a different file for your backup.')
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    const temporary = destination + '.' + crypto.randomUUID() + '.tmp'
    try {
      db.prepare('VACUUM INTO ?').run(temporary)
      const copy = new DatabaseSync(temporary)
      try {
        copy.exec('PRAGMA journal_mode=DELETE; CREATE TABLE IF NOT EXISTS attachments (case_id INTEGER PRIMARY KEY, bytes BLOB NOT NULL); BEGIN;')
        const insertAtt = copy.prepare('INSERT OR REPLACE INTO attachments VALUES (?,?)')
        try {
          for (const file of fs.readdirSync(pdfsDir)) {
            const m = file.match(/^(\d+)\.pdf$/)
            if (!m) continue
            insertAtt.run(Number(m[1]), fs.readFileSync(path.join(pdfsDir, file)))
          }
          copy.exec('COMMIT')
        } catch (e) { copy.exec('ROLLBACK'); throw e }
      } finally { copy.close() }
      fs.renameSync(temporary, destination)
    } finally { try { fs.unlinkSync(temporary) } catch {} }
    return { path: destination, count: info().count }
  }
  // Restore: snapshot source, safety-backup current state, then replace in a transaction.
  // PDFs on disk are quarantined first so a failure can roll them back.
  function restore(source) {
    if (path.resolve(source).toLowerCase() === path.resolve(filename).toLowerCase()) throw new Error('Choose a backup file, not the working database.')
    const other = new DatabaseSync(source, { readOnly: true })
    let rows, attachments = [], masters = []
    try {
      if (other.prepare('PRAGMA application_id').get().application_id !== APP_ID) throw new Error('This is not a compatible CourtDesk backup.')
      if (other.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('The backup is damaged.')
      rows = other.prepare('SELECT * FROM cases').all().map(row => ({...normalize(row), oldId: row.id}))
      const tables = other.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name)
      if (tables.includes('attachments')) attachments = other.prepare('SELECT * FROM attachments').all()
      if (tables.includes('masters')) masters = other.prepare('SELECT * FROM masters').all()
    } finally { other.close() }
    const safety = path.join(path.dirname(filename), 'backups', `before-restore-${Date.now()}.sqlite`)
    backup(safety)
    const quarantine = pdfsDir + '-restore-' + Date.now()
    const hadPdfs = fs.existsSync(pdfsDir) && fs.readdirSync(pdfsDir).length > 0
    if (hadPdfs) fs.renameSync(pdfsDir, quarantine)
    fs.mkdirSync(pdfsDir, { recursive: true })
    try {
      const toWrite = []
      transaction(() => {
        db.exec('DELETE FROM cases; DELETE FROM masters')
        for (const row of rows) {
          const result = insert.run(...values(row))
          const newId = Number(result.lastInsertRowid)
          const attachment = attachments.find(a => a.case_id === row.oldId)
          if (attachment) toWrite.push({ id: newId, bytes: attachment.bytes })
        }
        for (const master of masters) addMaster(master)
        touch()
      })
      for (const { id, bytes } of toWrite) writePdfAtomic(id, bytes)
      if (hadPdfs) fs.rmSync(quarantine, { recursive: true, force: true })
    } catch (e) {
      try { fs.rmSync(pdfsDir, { recursive: true, force: true }) } catch {}
      if (hadPdfs) { try { fs.renameSync(quarantine, pdfsDir) } catch {} }
      else { try { fs.mkdirSync(pdfsDir, { recursive: true }) } catch {} }
      throw e
    }
    return { ...info(), safetyBackup: safety }
  }
  function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.scryptSync(String(password), salt, 64).toString('hex')
    return `${salt}:${hash}`
  }
  function verifyPassword(password, stored) {
    try {
      const [salt, hash] = String(stored).split(':')
      if (!salt || !hash) return false
      const check = crypto.scryptSync(String(password), salt, 64).toString('hex')
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'))
    } catch { return false }
  }
  function validateCredentials(username, password) {
    if (!username || !/^[A-Za-z0-9._-]{3,32}$/.test(String(username).trim())) throw new Error('Username must be 3–32 characters, letters/numbers/._- only.')
    if (!password || String(password).length < 6) throw new Error('Password must be at least 6 characters.')
  }
  function logAction(entry) {
    db.prepare('INSERT INTO edit_log (user_id, username, action, case_id, case_regd_no, case_year, changes, timestamp) VALUES (?,?,?,?,?,?,?,?)')
      .run(entry.user_id || null, entry.username || 'system', entry.action, entry.case_id || null, entry.case_regd_no || null, entry.case_year || null, entry.changes ? JSON.stringify(entry.changes) : null, new Date().toISOString())
  }

  return {
    search, info, importRows, backup, restore, addMaster,
    hasAnyAdmin: () => db.prepare("SELECT 1 FROM users WHERE role='admin' AND enabled=1 LIMIT 1").get() != null,
    createUser: ({ username, password, role, created_by }) => {
      validateCredentials(username, password)
      if (!['admin','clerk'].includes(role)) throw new Error('Role must be admin or clerk.')
      try {
        const result = db.prepare('INSERT INTO users (username, password_hash, role, enabled, created_at, created_by) VALUES (?,?,?,1,?,?)')
          .run(String(username).trim(), hashPassword(password), role, new Date().toISOString(), created_by || null)
        logAction({ user_id: null, username: created_by || 'system', action: 'user.create', changes: { username: String(username).trim(), role } })
        return { id: Number(result.lastInsertRowid), username: String(username).trim(), role, enabled: 1 }
      } catch (e) {
        if (/UNIQUE/.test(e.message)) throw new Error('That username is already taken.')
        throw e
      }
    },
    listUsers: () => db.prepare('SELECT id, username, role, enabled, created_at, created_by FROM users ORDER BY created_at').all(),
    updateUser: (id, patch, actor) => {
      const user = db.prepare('SELECT * FROM users WHERE id=?').get(id)
      if (!user) throw new Error('User not found.')
      const updates = [], args = [], changes = {}
      if (patch.password != null) { validateCredentials(user.username, patch.password); updates.push('password_hash=?'); args.push(hashPassword(patch.password)); changes.password = 'reset' }
      if (patch.enabled != null) { updates.push('enabled=?'); args.push(patch.enabled ? 1 : 0); changes.enabled = !!patch.enabled }
      if (patch.role != null) {
        if (!['admin','clerk'].includes(patch.role)) throw new Error('Role must be admin or clerk.')
        if (user.role === 'admin' && patch.role !== 'admin' && db.prepare("SELECT count(*) AS n FROM users WHERE role='admin' AND enabled=1 AND id<>?").get(id).n === 0)
          throw new Error('Cannot demote the last admin.')
        updates.push('role=?'); args.push(patch.role); changes.role = patch.role
      }
      if (!updates.length) return user
      db.prepare(`UPDATE users SET ${updates.join(',')} WHERE id=?`).run(...args, id)
      if (patch.enabled === false || patch.password != null) db.prepare('DELETE FROM sessions WHERE user_id=?').run(id)
      logAction({ user_id: actor?.id, username: actor?.username || 'system', action: 'user.update', changes: { target: user.username, ...changes } })
      return db.prepare('SELECT id, username, role, enabled, created_at, created_by FROM users WHERE id=?').get(id)
    },
    login: (username, password) => {
      const user = db.prepare('SELECT id, username, password_hash, role, enabled FROM users WHERE username=? COLLATE NOCASE').get(String(username || '').trim())
      if (!user || !user.enabled) return null
      if (!verifyPassword(password, user.password_hash)) return null
      const token = crypto.randomBytes(32).toString('hex')
      const now = new Date().toISOString()
      db.prepare('INSERT INTO sessions (token, user_id, created_at, last_seen) VALUES (?,?,?,?)').run(token, user.id, now, now)
      logAction({ user_id: user.id, username: user.username, action: 'auth.login' })
      return { token, user: { id: user.id, username: user.username, role: user.role } }
    },
    sessionLookup: token => {
      if (!token) return null
      const row = db.prepare(`SELECT s.token, s.user_id, u.username, u.role, u.enabled, s.last_seen
                              FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?`).get(String(token))
      if (!row || !row.enabled) return null
      const last = new Date(row.last_seen).getTime()
      if (Date.now() - last > 7 * 24 * 3600 * 1000) { db.prepare('DELETE FROM sessions WHERE token=?').run(token); return null }
      db.prepare('UPDATE sessions SET last_seen=? WHERE token=?').run(new Date().toISOString(), token)
      return { id: row.user_id, username: row.username, role: row.role }
    },
    sessionDelete: token => db.prepare('DELETE FROM sessions WHERE token=?').run(String(token || '')),
    logAction,
    editLog: ({ limit = 100, offset = 0, user_id, action, since, until } = {}) => {
      const clauses = [], args = []
      if (user_id) { clauses.push('user_id=?'); args.push(Number(user_id)) }
      if (action) { clauses.push('action=?'); args.push(String(action)) }
      if (since) { clauses.push('timestamp>=?'); args.push(String(since)) }
      if (until) { clauses.push('timestamp<=?'); args.push(String(until)) }
      const where = clauses.length ? ' WHERE ' + clauses.join(' AND ') : ''
      const count = db.prepare('SELECT count(*) AS n FROM edit_log' + where).get(...args).n
      const data = db.prepare(`SELECT id, user_id, username, action, case_id, case_regd_no, case_year, changes, timestamp
                               FROM edit_log${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, Math.max(1, Math.min(1000, Number(limit) || 100)), Math.max(0, Number(offset) || 0))
      return { data: data.map(r => ({ ...r, changes: r.changes ? JSON.parse(r.changes) : null })), count }
    },
    updateCaseNumber: (key, caseNumber, actor) => {
      const value = caseNumber == null || String(caseNumber).trim() === '' ? null : String(caseNumber).trim()
      if (value && (!/^\d+$/.test(value) || Number(value) <= 0)) throw new Error('Case number must be a positive whole number.')
      return transaction(() => {
        const [where, args] = whereKey(key)
        const existing = db.prepare(`SELECT id,RegdNo,CYear,CaseNumber FROM cases WHERE ${where}`).get(...args)
        if (!existing) throw new Error('This case no longer exists.')
        const now = new Date().toISOString()
        db.prepare(`UPDATE cases SET CaseNumber=?, UpdatedAt=? WHERE ${where}`).run(value, now, ...args)
        touch()
        logAction({ user_id: actor?.id, username: actor?.username || 'system', action: 'case.caseNumber', case_id: existing.id, case_regd_no: existing.RegdNo, case_year: existing.CYear, changes: { from: existing.CaseNumber, to: value } })
        return { id: existing.id, RegdNo: existing.RegdNo, CYear: existing.CYear, CaseNumber: value }
      })
    },
    titles: () => [...new Set([...catalog.titles, ...db.prepare("SELECT code FROM masters WHERE kind='title'").all().map(r => r.code)])].sort(),
    pdf: key => {
      const [where, args] = whereKey(key)
      const row = db.prepare(`SELECT id,PdfName FROM cases WHERE ${where}`).get(...args)
      if (!row) throw new Error('Case not found.')
      if (!row.PdfName) return null
      const file = pdfPath(row.id)
      if (!fs.existsSync(file)) return null
      return { name: row.PdfName, bytes: fs.readFileSync(file) }
    },
    close: () => db.close(),
    create: data => {
      const bytes = validatePdf(data)
      const row = transaction(() => {
        const now = new Date().toISOString()
        const normalized = normalize({...data, CreatedAt: now, UpdatedAt: now})
        const result = insert.run(...values(normalized))
        touch()
        return {...normalized, id: Number(result.lastInsertRowid)}
      })
      if (bytes) writePdfAtomic(row.id, bytes)
      return row
    },
    update: (key, data) => {
      const bytes = validatePdf(data)
      const row = transaction(() => {
        const [where, args] = whereKey(key)
        const existing = db.prepare(`SELECT id,CreatedAt FROM cases WHERE ${where}`).get(...args)
        if (!existing) throw new Error('This case no longer exists. Refresh the register.')
        const normalized = normalize({...data, CreatedAt: existing.CreatedAt || data.CreatedAt || null, UpdatedAt: new Date().toISOString()})
        const result = db.prepare(`UPDATE cases SET ${FIELDS.map(f=>`"${f}"=?`).join(',')} WHERE ${where}`).run(...values(normalized), ...args)
        if (!result.changes) throw new Error('This case no longer exists. Refresh the register.')
        touch()
        return {...normalized, id: existing.id}
      })
      if (bytes) writePdfAtomic(row.id, bytes)
      return row
    },
    delete: key => {
      const result = transaction(() => {
        const [where, args] = whereKey(key)
        const row = db.prepare(`SELECT id FROM cases WHERE ${where}`).get(...args)
        const res = db.prepare(`DELETE FROM cases WHERE ${where}`).run(...args)
        if (!res.changes) throw new Error('This case no longer exists.')
        touch()
        return { id: row?.id, deleted: res.changes }
      })
      if (result.id) removeAttachment(result.id)
      return { deleted: result.deleted }
    },
    keys: () => db.prepare('SELECT RegdNo,CYear FROM cases').all(),
    next: () => db.prepare('SELECT COALESCE(MAX(RegdNo),0)+1 AS n FROM cases').get().n,
    districts: () => [...catalog.districts].sort().map(name => ({id: name, name})),
    types: () => { const items = [...catalog.types, ...db.prepare("SELECT code AS short_type,name AS long_type FROM masters WHERE kind='type'").all()]; return [...new Map(items.map(t => [t.short_type+' - '+t.long_type, {...t, id: t.short_type+' - '+t.long_type}])).values()] },
    advocates: query => { const items = db.prepare("SELECT name,mo_no FROM masters WHERE kind='advocate'").all(); return [...new Map(items.filter(r => r.name && r.name.toLowerCase().includes(String(query||'').toLowerCase())).map(r => [r.name.trim(), {...r, name: r.name.trim()}])).values()].sort((a,b) => a.name.localeCompare(b.name)).slice(0,100) },
  }
}
module.exports = { openRegister, FIELDS, normalize }
