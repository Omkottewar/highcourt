import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co'
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseKey)

// ── Cases ──────────────────────────────────────────────────────────────────

export async function searchCases({ query, district, caseType, dateFrom, dateTo, cyear, page = 0, pageSize = 50 }) {
  let q = supabase
    .from('SearchFile')
    .select('*', { count: 'exact' })

  if (query) {
    const safe = query.replace(/[%_]/g, '\\$&')
    q = q.or(`Petitioner.ilike.%${safe}%,RESPONDENT.ilike.%${safe}%,ADVOCATE.ilike.%${safe}%`)
  }
  if (district) q = q.eq('District', district)
  if (caseType) q = q.eq('Type', caseType)
  if (dateFrom) q = q.gte('DATE', dateFrom)
  if (dateTo)   q = q.lte('DATE', dateTo)
  if (cyear)    q = q.eq('CYear', cyear)

  q = q.order('DATE', { ascending: false })
       .range(page * pageSize, (page + 1) * pageSize - 1)

  return q
}

export async function getCaseById(id) {
  return supabase.from('v_case_detail').select('*').eq('id', id).single()
}

export async function getCaseRespondents(caseId) {
  return supabase
    .from('case_respondents')
    .select('*, departments(full_name, short_name)')
    .eq('case_id', caseId)
    .order('resp_no')
}

export async function getCaseRemarks(caseId) {
  return supabase
    .from('case_remarks')
    .select('*, staff(full_name)')
    .eq('case_id', caseId)
    .order('added_at', { ascending: false })
}

export async function getCaseHearings(caseId) {
  return supabase
    .from('case_hearings')
    .select('*, staff(full_name)')
    .eq('case_id', caseId)
    .order('hearing_date', { ascending: false })
}

export async function createCase(data) {
  return supabase.from('cases').insert(data).select().single()
}

export async function updateCase(id, data) {
  return supabase.from('cases').update(data).eq('id', id).select().single()
}

export async function softDeleteCase(id, reason) {
  return supabase.from('cases').update({ is_deleted: true, deletion_reason: reason }).eq('id', id)
}

export async function addRemark(caseId, note) {
  return supabase.from('case_remarks').insert({ case_id: caseId, note })
}

export async function addHearing(data) {
  return supabase.from('case_hearings').insert(data)
}

// ── Lookup tables ──────────────────────────────────────────────────────────

export async function getDistricts() {
  return supabase.from('districts').select('id, name, division').eq('is_active', true).order('name')
}

export async function getCaseTypes() {
  return supabase.from('case_types').select('id, short_code, long_name').eq('is_active', true)
}

export async function getAdvocates(query) {
  let q = supabase.from('advocates').select('id, full_name, short_name, mobile_no').eq('is_active', true)
  if (query) q = q.ilike('full_name', `%${query}%`)
  return q.order('full_name').limit(30)
}

export async function getDepartments(query) {
  let q = supabase.from('departments').select('id, full_name, short_name').eq('is_active', true)
  if (query) q = q.ilike('full_name', `%${query}%`)
  return q.order('full_name').limit(30)
}

export async function getUpcomingHearings() {
  return supabase.from('v_upcoming_hearings').select('*').limit(20)
}

// ── Dashboard stats ────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const today = new Date().toISOString().split('T')[0]
  const [total, todayCount, districts] = await Promise.all([
    supabase.from('cases').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
    supabase.from('cases').select('id', { count: 'exact', head: true }).eq('dated', today).eq('is_deleted', false),
    supabase.from('cases').select('district_id, districts(name)', { count: 'exact' })
      .eq('is_deleted', false).limit(200)
  ])
  return { total: total.count, today: todayCount.count, districts: districts.data }
}

export async function getNextRegdNo(cyear) {
  const { data } = await supabase
    .from('cases')
    .select('regd_no')
    .eq('cyear', cyear)
    .order('regd_no', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? data.regd_no + 1 : 1
}

// ── Auth ───────────────────────────────────────────────────────────────────

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getCurrentStaff() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('staff').select('*').eq('id', user.id).single()
  return data
}
