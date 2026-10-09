import { importKey } from '../utils/importCases'

const isClient = () => window.desktop?.mode === 'client'
const token = () => localStorage.getItem('courtdesk-token') || ''
const serverUrl = () => window.desktop?.serverUrl || ''

async function remoteCall(op, payload) {
  const res = await fetch(`${serverUrl()}/api/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
    body: JSON.stringify({ op, payload }),
  })
  if (res.status === 401) {
    localStorage.removeItem('courtdesk-token')
    window.dispatchEvent(new Event('courtdesk-unauthenticated'))
    throw new Error('Session expired. Please sign in again.')
  }
  const data = await res.json().catch(() => ({ error: 'Invalid server response' }))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data.value
}

async function remotePdfUpload(id, name, bytes) {
  const res = await fetch(`${serverUrl()}/api/pdf?id=${id}&name=${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf', Authorization: `Bearer ${token()}` },
    body: bytes,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'PDF upload failed')
  }
}

async function remotePdfDownload(key) {
  const params = key.id ? `id=${key.id}` : `regdNo=${key.RegdNo}&cYear=${encodeURIComponent(key.CYear || '')}`
  const res = await fetch(`${serverUrl()}/api/pdf?${params}`, { headers: { Authorization: `Bearer ${token()}` } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error('PDF download failed')
  const cd = res.headers.get('content-disposition') || ''
  const match = cd.match(/filename\*=UTF-8''([^;]+)/) || cd.match(/filename="([^"]+)"/)
  const name = match ? decodeURIComponent(match[1]) : 'attachment.pdf'
  const bytes = new Uint8Array(await res.arrayBuffer())
  return { name, bytes }
}

async function localCall(operation, payload) {
  if (!window.desktop?.database) throw new Error('Open the CourtDesk desktop app to use your local database.')
  const result = await window.desktop.database(operation, payload)
  if (result.error) throw new Error(result.error)
  return result.value
}

async function call(operation, payload) {
  if (!isClient()) return localCall(operation, payload)
  if (['backup','restore'].includes(operation)) throw new Error('Backup and restore must be run on the main server PC.')
  if (operation === 'pdf') return remotePdfDownload(payload)
  if (operation === 'create' && payload?.PdfBytes) {
    const { PdfBytes, PdfName, ...rest } = payload
    const row = await remoteCall('create', { ...rest, PdfName })
    try { await remotePdfUpload(row.id, PdfName, PdfBytes) }
    catch (e) { throw new Error(`Case saved, but PDF upload failed: ${e.message}`) }
    return row
  }
  if (operation === 'update' && payload?.data?.PdfBytes) {
    const { PdfBytes, PdfName, ...restData } = payload.data
    const row = await remoteCall('update', { key: payload.key, data: { ...restData, PdfName } })
    try { await remotePdfUpload(row.id, PdfName, PdfBytes) }
    catch (e) { throw new Error(`Case saved, but PDF upload failed: ${e.message}`) }
    return row
  }
  const remoteOp = operation === 'all' ? 'searchAll' : operation
  return remoteCall(remoteOp, payload)
}

async function wrapped(operation, payload) {
  try { return { data: await call(operation, payload), error: null } }
  catch (error) { return { data: null, error } }
}

export async function searchCases(filters = {}) {
  try { return { ...await call('search', filters), error: null } }
  catch (error) { return { data: [], count: 0, error } }
}
export async function searchAllCases(filters, onProgress) {
  const { data } = await call('all', filters)
  onProgress?.(data.length, data.length)
  return data
}
export const createCase = data => wrapped('create', data)
export const updateCase = (key, data) => wrapped('update', { key, data })
export const deleteCase = key => wrapped('delete', key)
export const getNextRegdNo = () => call('next')
export const getDistrictOptions = () => wrapped('districts')
export const getCaseTypeOptions = () => wrapped('types')
export const getAdvocates = query => wrapped('advocates', query)
export const getDatabaseInfo = () => call('info')
export const backupDatabase = () => call('backup')
export const restoreDatabase = () => call('restore')
export async function getExistingImportKeys(onProgress) {
  const rows = await call('keys')
  onProgress?.(rows.length, rows.length)
  return new Set(rows.map(importKey))
}
export async function insertNewImportCases(records, onProgress) {
  onProgress?.({ phase: 'saving', imported: 0, total: records.length })
  const result = await call('import', records.map(record => record.data))
  onProgress?.({ phase: 'done', imported: result.imported, total: records.length })
  return result
}

export const getTitleOptions = () => wrapped('titles')
export const addMaster = data => wrapped('addMaster', data)
export const getCasePdf = key => wrapped('pdf', key)

export async function login(username, password) {
  if (!isClient()) {
    const result = await window.desktop.localLogin(username, password)
    localStorage.setItem('courtdesk-token', result.token)
    return result.user
  }
  const res = await fetch(`${serverUrl()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json().catch(() => ({ error: 'Invalid server response' }))
  if (!res.ok) throw new Error(data.error || 'Login failed')
  localStorage.setItem('courtdesk-token', data.token)
  return data.user
}
export async function fetchMe() {
  if (!isClient()) {
    if (!token()) return null
    try {
      const user = await window.desktop.localMe(token())
      if (!user) localStorage.removeItem('courtdesk-token')
      return user
    } catch { return null }
  }
  if (!token()) return null
  try {
    const res = await fetch(`${serverUrl()}/auth/me`, { headers: { Authorization: `Bearer ${token()}` } })
    if (!res.ok) { if (res.status === 401) localStorage.removeItem('courtdesk-token'); return null }
    const data = await res.json()
    return data.user
  } catch { return null }
}
export async function logout() {
  const t = token()
  if (isClient()) {
    try { await fetch(`${serverUrl()}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${t}` } }) } catch {}
  } else {
    try { await window.desktop.localLogout(t) } catch {}
  }
  localStorage.removeItem('courtdesk-token')
}
export async function hasAnyAdmin() {
  if (isClient()) return true
  return window.desktop.localHasAdmin()
}
export async function createFirstAdmin(username, password) {
  if (isClient()) throw new Error('First admin must be created on the main server PC.')
  const result = await window.desktop.localCreateFirstAdmin(username, password)
  localStorage.setItem('courtdesk-token', result.token)
  return result.user
}

export const listUsers = () => wrapped('listUsers')
export const createUser = payload => wrapped('createUser', payload)
export const updateUser = (id, patch) => wrapped('updateUser', { id, patch })
export const getEditLog = (filters = {}) => wrapped('editLog', filters)
export const updateCaseNumber = (key, caseNumber) => wrapped('updateCaseNumber', { key, caseNumber })
