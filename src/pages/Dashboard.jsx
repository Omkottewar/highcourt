import { useEffect, useState } from 'react'
import { getUpcomingHearings, supabase } from '../lib/supabase'
import { Spinner, CaseBadge } from '../components/UI'
import { format } from 'date-fns'

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="stat-card" style={accent ? { border: '1px solid rgba(201,168,76,0.3)' } : {}}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value ?? <Spinner size={24} />}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats]       = useState({})
  const [hearings, setHearings] = useState([])
  const [loading, setLoading]   = useState(true)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    async function load() {
      const [total, todayQ, thisYear, hearingsQ] = await Promise.all([
        supabase.from('cases').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
        supabase.from('cases').select('id', { count: 'exact', head: true }).eq('dated', today).eq('is_deleted', false),
        supabase.from('cases').select('id', { count: 'exact', head: true })
          .eq('cyear', new Date().getFullYear()).eq('is_deleted', false),
        getUpcomingHearings()
      ])
      setStats({ total: total.count, today: todayQ.count, thisYear: thisYear.count })
      setHearings(hearingsQ.data || [])
      setLoading(false)
    }
    load()
  }, [today])

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{format(new Date(), 'EEEE, d MMMM yyyy')} · Nagpur Bench</p>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Total cases" value={stats.total} sub="All time" accent />
        <StatCard label="Filed today"   value={stats.today}   sub={format(new Date(), 'dd MMM yyyy')} />
        <StatCard label={`Filed in ${new Date().getFullYear()}`} value={stats.thisYear} sub="Current year" />
        <StatCard label="Upcoming hearings" value={hearings.length} sub="Next 30 days" />
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Upcoming Hearings</span>
          <span className="badge badge-dist">{hearings.length} scheduled</span>
        </div>
        <div className="table-wrap">
          {loading ? (
            <div className="loading-row"><Spinner /></div>
          ) : hearings.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-icon">📅</div>
              <div className="empty-text">No upcoming hearings</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Hearing date</th>
                  <th>Regd. No.</th>
                  <th>Case type</th>
                  <th>Petitioner</th>
                  <th>District</th>
                  <th>WP Number</th>
                  <th>Next date</th>
                </tr>
              </thead>
              <tbody>
                {hearings.map(h => (
                  <tr key={h.hearing_id}>
                    <td className="mono">{h.hearing_date ? format(new Date(h.hearing_date), 'dd/MM/yyyy') : '—'}</td>
                    <td className="mono">{h.regd_no}/{h.cyear}</td>
                    <td><CaseBadge type={h.case_type} /></td>
                    <td className="truncate">{h.petitioner}</td>
                    <td><span className="badge badge-dist">{h.district}</span></td>
                    <td className="mono muted">{h.wp_number || '—'}</td>
                    <td className="mono">{h.next_date ? format(new Date(h.next_date), 'dd/MM/yyyy') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
