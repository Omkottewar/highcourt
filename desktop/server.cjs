const http = require('node:http')
const url = require('node:url')

function startServer({ register, port = 4788 }) {
  const bodyBuffer = req => new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    req.on('data', c => { total += c.length; if (total > 60 * 1024 * 1024) { reject(new Error('Request body too large')); req.destroy() } else chunks.push(c) })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
    req.on('aborted', () => reject(new Error('Request aborted')))
  })
  const bodyJson = async req => {
    const buf = await bodyBuffer(req)
    if (!buf.length) return {}
    try { return JSON.parse(buf.toString('utf8')) } catch { throw Object.assign(new Error('Invalid JSON body'), { statusCode: 400 }) }
  }
  const sendJson = (res, status, body) => {
    if (res.headersSent) return
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(body))
  }
  const sendError = (res, status, message) => sendJson(res, status, { error: message })
  const authFromReq = req => {
    const h = req.headers.authorization || ''
    const token = h.startsWith('Bearer ') ? h.slice(7).trim() : null
    return token ? register.sessionLookup(token) : null
  }
  const assertAdmin = user => {
    if (!user || user.role !== 'admin') { const e = new Error('Admin access required.'); e.statusCode = 403; throw e }
  }

  const loginAttempts = new Map()
  const canAttemptLogin = username => {
    const row = loginAttempts.get(String(username || '').toLowerCase())
    return !row || row.until <= Date.now()
  }
  const recordLoginFail = username => {
    const key = String(username || '').toLowerCase()
    const row = loginAttempts.get(key) || { count: 0, until: 0 }
    row.count += 1
    if (row.count >= 5) { row.until = Date.now() + 15 * 60 * 1000; row.count = 0 }
    loginAttempts.set(key, row)
  }
  const resetLoginFail = username => loginAttempts.delete(String(username || '').toLowerCase())

  const CLERK_OPS = new Set(['search','searchAll','info','advocates','titles','types','districts','pdfMeta','updateCaseNumber','me'])
  const ADMIN_OPS = new Set(['create','update','delete','import','keys','next','addMaster','listUsers','createUser','updateUser','editLog'])

  const dispatch = (op, payload, user) => {
    if (ADMIN_OPS.has(op) && user.role !== 'admin') { const e = new Error('Admin access required.'); e.statusCode = 403; throw e }
    if (!CLERK_OPS.has(op) && !ADMIN_OPS.has(op)) { const e = new Error(`Unknown operation: ${op}`); e.statusCode = 400; throw e }
    switch (op) {
      case 'search': return register.search(payload || {})
      case 'searchAll': return { data: register.search(payload || {}, true).data }
      case 'info': return register.info()
      case 'advocates': return register.advocates(payload || '')
      case 'titles': return register.titles()
      case 'types': return register.types()
      case 'districts': return register.districts()
      case 'pdfMeta': return { attached: !!register.pdf(payload) }
      case 'me': return { user }
      case 'editLog': return register.editLog(payload || {})
      case 'updateCaseNumber': return register.updateCaseNumber(payload.key, payload.caseNumber, user)
      case 'create': {
        const row = register.create(payload)
        register.logAction({ user_id: user.id, username: user.username, action: 'case.create', case_id: row.id, case_regd_no: row.RegdNo, case_year: row.CYear })
        return row
      }
      case 'update': {
        const row = register.update(payload.key, payload.data)
        register.logAction({ user_id: user.id, username: user.username, action: 'case.update', case_id: row.id, case_regd_no: row.RegdNo, case_year: row.CYear })
        return row
      }
      case 'delete': {
        const result = register.delete(payload)
        register.logAction({ user_id: user.id, username: user.username, action: 'case.delete', case_regd_no: payload?.RegdNo, case_year: payload?.CYear })
        return result
      }
      case 'import': {
        const result = register.importRows(payload)
        register.logAction({ user_id: user.id, username: user.username, action: 'case.import', changes: { imported: result.imported, skipped: result.skipped } })
        return result
      }
      case 'keys': return register.keys()
      case 'next': return register.next()
      case 'addMaster': return register.addMaster(payload)
      case 'listUsers': return register.listUsers()
      case 'createUser': return register.createUser({ ...payload, created_by: user.username })
      case 'updateUser': return register.updateUser(payload.id, payload.patch, user)
      default: { const e = new Error('Unhandled op'); e.statusCode = 500; throw e }
    }
  }

  const server = http.createServer(async (req, res) => {
    try {
      const parsed = url.parse(req.url || '', true)
      const pathname = parsed.pathname
      const method = req.method

      if (method === 'GET' && pathname === '/health') return sendJson(res, 200, { ok: true })

      if (method === 'POST' && pathname === '/auth/login') {
        const body = await bodyJson(req)
        if (!canAttemptLogin(body.username)) return sendError(res, 429, 'Too many failed login attempts. Wait 15 minutes.')
        const result = register.login(body.username, body.password)
        if (!result) { recordLoginFail(body.username); return sendError(res, 401, 'Invalid username or password.') }
        resetLoginFail(body.username)
        return sendJson(res, 200, result)
      }

      const user = authFromReq(req)
      if (!user) return sendError(res, 401, 'Not authenticated.')

      if (method === 'GET' && pathname === '/auth/me') return sendJson(res, 200, { user })
      if (method === 'POST' && pathname === '/auth/logout') {
        const token = (req.headers.authorization || '').replace(/^Bearer\s+/, '').trim()
        register.sessionDelete(token)
        register.logAction({ user_id: user.id, username: user.username, action: 'auth.logout' })
        return sendJson(res, 200, { ok: true })
      }

      if (method === 'GET' && pathname === '/api/pdf') {
        const q = parsed.query
        const key = q.id ? { id: Number(q.id) } : { RegdNo: Number(q.regdNo), CYear: q.cYear }
        const file = register.pdf(key)
        if (!file) return sendError(res, 404, 'No PDF attached.')
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
          'Content-Length': file.bytes.length,
          'Cache-Control': 'no-store',
        })
        return res.end(file.bytes)
      }

      if (method === 'POST' && pathname === '/api/pdf') {
        try { assertAdmin(user) } catch (e) { return sendError(res, e.statusCode, e.message) }
        const q = parsed.query
        if (!q.id || !q.name) return sendError(res, 400, 'id and name query params are required.')
        const bytes = await bodyBuffer(req)
        if (bytes.length === 0) return sendError(res, 400, 'Empty PDF upload.')
        if (bytes.length > 50*1024*1024 || bytes.subarray(0,5).toString() !== '%PDF-') return sendError(res, 400, 'Invalid PDF (max 50 MB).')
        try {
          const existing = register.search({ query: String(q.id), searchField: 'RegdNo', matchMode: 'exact', pageSize: 1 }).data.find(r => r.id === Number(q.id))
          if (!existing) return sendError(res, 404, 'Case not found.')
          register.update({ id: Number(q.id) }, { ...existing, PdfName: String(q.name), PdfBytes: bytes })
          register.logAction({ user_id: user.id, username: user.username, action: 'case.pdfUpload', case_id: existing.id, case_regd_no: existing.RegdNo, case_year: existing.CYear })
          return sendJson(res, 200, { ok: true })
        } catch (e) { return sendError(res, 400, e.message) }
      }

      if (method === 'POST' && pathname === '/api/call') {
        const { op, payload } = await bodyJson(req)
        try {
          const value = dispatch(op, payload, user)
          return sendJson(res, 200, { value })
        } catch (e) {
          return sendError(res, e.statusCode || 400, e.message || 'Request failed.')
        }
      }

      sendError(res, 404, 'Not found.')
    } catch (e) {
      sendJson(res, e.statusCode || 500, { error: e.message || 'Server error' })
    }
  })

  server.on('error', err => console.error('CourtDesk server error:', err))
  server.listen(port, '0.0.0.0', () => console.log(`CourtDesk API listening on 0.0.0.0:${port}`))
  return server
}

module.exports = { startServer }
