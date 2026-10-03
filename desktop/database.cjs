const { DatabaseSync } = require('node:sqlite')
const fs = require('node:fs')
const path = require('node:path')
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
  const version = db.prepare('PRAGMA user_version').get().user_version
  if (version > 2) { db.close(); throw new Error('This database needs a newer version of CourtDesk.') }
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
    CREATE TABLE IF NOT EXISTS attachments (case_id INTEGER PRIMARY KEY, bytes BLOB NOT NULL);`)
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
    const advocatesPath = require('node:fs').existsSync(path.join(__dirname,'..','data','advocates.json'))
      ? path.join(__dirname,'..','data','advocates.json')
      : path.join(process.resourcesPath || '', 'advocates.json')
    if (require('node:fs').existsSync(advocatesPath)) {
      for (const adv of require(advocatesPath)) addMaster({kind:'advocate',code:adv.code || '',name:adv.name,mo_no:adv.mo_no || ''})
    }
  } catch {}
  function saveAttachment(id, data) {
    if (data.PdfBytes == null) return
    const bytes=Buffer.from(data.PdfBytes)
    if (bytes.length>50*1024*1024 || bytes.subarray(0,5).toString()!=='%PDF-' || !data.PdfName) throw new Error('Choose a valid PDF up to 50 MB.')
    db.prepare('INSERT OR REPLACE INTO attachments VALUES (?,?)').run(id,bytes)
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
  const info=()=>({path:filename,count:db.prepare('SELECT count(*) AS n FROM cases').get().n,updatedAt:db.prepare("SELECT value FROM metadata WHERE key='updatedAt'").get()?.value || null})
  function importRows(rows) {
    if(!Array.isArray(rows)||rows.length>100000) throw new Error('Import at most 100,000 rows at a time.')
    const now=new Date().toISOString()
    return transaction(()=>{let imported=0; for(const data of rows) imported+=insertSkip.run(...values(normalize({...data,UpdatedAt:now}))).changes; if(imported)touch(); return {imported,skipped:rows.length-imported,remaining:0}})
  }
  function backup(destination) {
    if(path.resolve(destination).toLowerCase()===path.resolve(filename).toLowerCase()) throw new Error('Choose a different file for your backup.')
    fs.mkdirSync(path.dirname(destination),{recursive:true})
    const temporary=destination+'.'+require('node:crypto').randomUUID()+'.tmp'
    try { db.prepare('VACUUM INTO ?').run(temporary); fs.renameSync(temporary,destination) } finally { if(fs.existsSync(temporary))fs.unlinkSync(temporary) }
    return {path:destination,count:info().count}
  }
  function restore(source) {
    if(path.resolve(source).toLowerCase()===path.resolve(filename).toLowerCase())throw new Error('Choose a backup file, not the working database.')
    const other=new DatabaseSync(source,{readOnly:true})
    let rows, attachments=[], masters=[]
    try {
      if(other.prepare('PRAGMA application_id').get().application_id!==APP_ID || ![1,2].includes(other.prepare('PRAGMA user_version').get().user_version))throw new Error('This is not a compatible CourtDesk backup.')
      if(other.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw new Error('The backup is damaged.')
      rows=other.prepare('SELECT * FROM cases').all().map(row=>({...normalize(row),oldId:row.id}))
      const tables=other.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t=>t.name)
      if(tables.includes('attachments')) attachments=other.prepare('SELECT * FROM attachments').all()
      if(tables.includes('masters')) masters=other.prepare('SELECT * FROM masters').all()
    } finally {other.close()}
    const safety=path.join(path.dirname(filename),'backups',`before-restore-${Date.now()}.sqlite`)
    backup(safety)
    transaction(()=>{db.exec('DELETE FROM attachments; DELETE FROM cases; DELETE FROM masters');for(const row of rows){const result=insert.run(...values(row));const attachment=attachments.find(a=>a.case_id===row.oldId);if(attachment)db.prepare('INSERT INTO attachments VALUES (?,?)').run(Number(result.lastInsertRowid),attachment.bytes)}for(const master of masters)addMaster(master);touch()})
    return {...info(),safetyBackup:safety}
  }
  return {
    search,info,importRows,backup,restore,addMaster,
    titles:()=>[...new Set([...catalog.titles,...db.prepare("SELECT code FROM masters WHERE kind='title'").all().map(r=>r.code)])].sort(),
    pdf:key=>{const [where,args]=whereKey(key);const row=db.prepare(`SELECT id,PdfName FROM cases WHERE ${where}`).get(...args);if(!row)throw new Error('Case not found.');const file=db.prepare('SELECT bytes FROM attachments WHERE case_id=?').get(row.id);return file?{name:row.PdfName,bytes:file.bytes}:null},
    close:()=>db.close(),
    create:data=>transaction(()=>{const now=new Date().toISOString();const row=normalize({...data,CreatedAt:now,UpdatedAt:now});const result=insert.run(...values(row));saveAttachment(Number(result.lastInsertRowid),data);touch();return {...row,id:Number(result.lastInsertRowid)}}),
    update:(key,data)=>transaction(()=>{const [where,args]=whereKey(key);const existing=db.prepare(`SELECT id,CreatedAt FROM cases WHERE ${where}`).get(...args);if(!existing)throw new Error('This case no longer exists. Refresh the register.');const row=normalize({...data,CreatedAt:existing.CreatedAt || data.CreatedAt || null,UpdatedAt:new Date().toISOString()});const result=db.prepare(`UPDATE cases SET ${FIELDS.map(f=>`"${f}"=?`).join(',')} WHERE ${where}`).run(...values(row),...args);if(!result.changes)throw new Error('This case no longer exists. Refresh the register.');saveAttachment(existing.id,data);touch();return row}),
    delete:key=>transaction(()=>{const [where,args]=whereKey(key);const row=db.prepare(`SELECT id FROM cases WHERE ${where}`).get(...args);if(row)db.prepare("DELETE FROM attachments WHERE case_id=?").run(row.id);const result=db.prepare(`DELETE FROM cases WHERE ${where}`).run(...args);if(!result.changes)throw new Error('This case no longer exists.');touch();return {deleted:result.changes}}),
    keys:()=>db.prepare('SELECT RegdNo,CYear FROM cases').all(),
    next:()=>db.prepare('SELECT COALESCE(MAX(RegdNo),0)+1 AS n FROM cases').get().n,
    districts:()=>[...catalog.districts].sort().map(name=>({id:name,name})),
    types:()=>{const items=[...catalog.types,...db.prepare("SELECT code AS short_type,name AS long_type FROM masters WHERE kind='type'").all()];return [...new Map(items.map(t=>[t.short_type+' - '+t.long_type,{...t,id:t.short_type+' - '+t.long_type}])).values()]},
    advocates:query=>{const items=db.prepare("SELECT name,mo_no FROM masters WHERE kind='advocate'").all();return [...new Map(items.filter(r=>r.name && r.name.toLowerCase().includes(String(query||'').toLowerCase())).map(r=>[r.name.trim(),{...r,name:r.name.trim()}])).values()].sort((a,b)=>a.name.localeCompare(b.name)).slice(0,100)},
  }
}
module.exports={openRegister,FIELDS,normalize}
