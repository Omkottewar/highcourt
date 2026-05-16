import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co'
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseKey)

// All case data lives in the raw "tblRegEntry" table (imported from the CSV
// export). It has no surrogate key — a row is identified by RegdNo + CYear.
const TABLE = 'tblRegEntry'

const CASE_COLUMNS =
  'RegdNo, CYear, Petitioner, Respondets, Adv, Dated, Copies, District, RespndentNo, Type, Remark, AdvAddress, AdvMoNo, LongType'

// ── Cases ──────────────────────────────────────────────────────────────────

export async function searchCases({
  query, searchField = 'Petitioner',
  district, caseType, dateFrom, dateTo, cyear,
  sortField = 'Dated', sortAsc = false, page = 0, pageSize = 50,
}) {
  let q = supabase.from(TABLE).select(CASE_COLUMNS, { count: 'exact' })

  // Field-scoped search: only the column chosen in the dropdown is matched.
  if (query) {
    const safe = query.trim().replace(/[%_]/g, '\\$&').replace(/[(),]/g, '')
    if (safe) {
      if (searchField === 'RegdNo') {
        // RegdNo is bigint and PostgREST doesn't allow casting to text inside
        // filters, so we emulate prefix-match with a union of ranges:
        // typing "82" → 82, [820,830), [8200,8300), [82000,83000), …
        if (/^\d+$/.test(safe)) {
          const ranges = []
          let lo = parseInt(safe, 10)
          let hi = lo + 1
          for (let i = 0; i < 7 && lo < Number.MAX_SAFE_INTEGER / 10; i++) {
            ranges.push(`and(RegdNo.gte.${lo},RegdNo.lt.${hi})`)
            lo *= 10; hi *= 10
          }
          q = q.or(ranges.join(','))
        } else {
          q = q.eq('RegdNo', -1) // non-numeric input → no results
        }
      } else {
        q = q.ilike(searchField, `%${safe}%`)
      }
    }
  }

  if (district) q = q.eq('District', district)
  if (caseType) q = q.eq('Type', caseType)
  if (dateFrom) q = q.gte('Dated', dateFrom)
  if (dateTo)   q = q.lte('Dated', dateTo)
  if (cyear)    q = q.eq('CYear', String(cyear))

  const ALLOWED_SORT = ['Dated', 'RegdNo', 'CYear', 'Petitioner', 'Copies']
  const field = ALLOWED_SORT.includes(sortField) ? sortField : 'Dated'
  q = q.order(field, { ascending: sortAsc, nullsFirst: false })
       .range(page * pageSize, (page + 1) * pageSize - 1)

  return q
}

// Fetches every row matching the given filters. Used by the Excel export.
//
// Strategy: the Supabase REST API caps each response at 1000 rows. Instead of
// looping page-by-page (one round-trip per 1000 rows — slow), we issue the
// first request to learn the total count, then fire ALL remaining pages in
// parallel via Promise.all. For a 20k-row export this turns ~20 sequential
// round-trips into 1 + 1 batch, typically a 4–8× speedup.
export async function searchAllCases(filters, onProgress) {
  const PAGE = 1000
  const first = await searchCases({ ...filters, page: 0, pageSize: PAGE })
  if (first.error) throw first.error

  const total = first.count || 0
  const all = first.data ? [...first.data] : []
  onProgress?.(all.length, total)

  if (all.length >= total) return all

  const totalPages = Math.ceil(total / PAGE)
  const requests = []
  for (let p = 1; p < totalPages; p++) {
    requests.push(searchCases({ ...filters, page: p, pageSize: PAGE }))
  }

  const results = await Promise.all(requests)
  for (const r of results) {
    if (r.error) throw r.error
    if (r.data) all.push(...r.data)
  }
  onProgress?.(all.length, total)
  return all
}

export async function createCase(data) {
  return supabase.from(TABLE).insert(data).select().single()
}

export async function updateCase(key, data) {
  let q = supabase.from(TABLE).update(data).eq('RegdNo', key.RegdNo)
  q = key.CYear == null ? q.is('CYear', null) : q.eq('CYear', key.CYear)
  return q.select()
}

export async function deleteCase(key) {
  let q = supabase.from(TABLE).delete().eq('RegdNo', key.RegdNo)
  q = key.CYear == null ? q.is('CYear', null) : q.eq('CYear', key.CYear)
  return q
}

// Next registration number = highest RegdNo on record + 1 (across all years).
export async function getNextRegdNo() {
  const { data } = await supabase
    .from(TABLE)
    .select('RegdNo')
    .order('RegdNo', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? Number(data.RegdNo) + 1 : 1
}

// ── Lookup tables — drive both the filter dropdowns and the case form ──────

export async function getDistrictOptions() {
  return supabase.from('district').select('id, name').order('name')
}

export async function getCaseTypeOptions() {
  return supabase
    .from('case_type')
    .select('id, short_type, long_type')
    .order('long_type', { nullsFirst: false })
}

// ── Advocate master (for autocomplete in the case form) ────────────────────

export async function getAdvocates(query) {
  let q = supabase.from('adv_master').select('id, name, address, mo_no')
  if (query) q = q.ilike('name', `%${query}%`)
  return q.order('name').limit(30)
}

