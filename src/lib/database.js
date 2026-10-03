import { importKey } from '../utils/importCases'
async function call(operation, payload) {
  if (!window.desktop?.database) throw new Error('Open the CourtDesk desktop app to use your local database.')
  const result = await window.desktop.database(operation, payload)
  if (result.error) throw new Error(result.error)
  return result.value
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
