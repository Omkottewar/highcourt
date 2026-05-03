import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import LoginPage    from './pages/Login'
import Dashboard    from './pages/Dashboard'
import CasesPage    from './pages/Cases'
import AdvocatesPage from './pages/Advocates'
import AuditPage    from './pages/Audit'
import { signOut }  from './lib/supabase'
import { Spinner }  from './components/UI'
import './index.css'

function AppShell() {
  const { user, staff, loading } = useAuth()

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)' }}>
      <Spinner size={32} />
    </div>
  )

  if (!user) return <LoginPage />

  const canViewAudit = ['admin', 'supervisor'].includes(staff?.role)
  const initials = staff?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'

  return (
    <div className="app-shell">
      {/* Top bar */}
      <header className="topbar">
        <div className="topbar-logo">
          ⚖ Office of the Government Pleader
          <span>High Court of Bombay · Bench at Nagpur</span>
        </div>
        <div className="topbar-divider" />
        <div className="topbar-right">
          <div className="user-chip" onClick={signOut} title="Sign out">
            <div className="user-avatar">{initials}</div>
            <span className="user-name">{staff?.full_name || user.email}</span>
            {staff?.role && <span className="role-badge">{staff.role}</span>}
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-section">Navigation</div>
        <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">⊞</span>
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/cases" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">📋</span>
          <span>Cases</span>
        </NavLink>
        <NavLink to="/advocates" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">👤</span>
          <span>Advocates</span>
        </NavLink>

        <div className="sidebar-section" style={{ marginTop: 8 }}>Admin</div>
        {canViewAudit && (
          <NavLink to="/audit" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">🔍</span>
            <span>Audit log</span>
          </NavLink>
        )}
        <div className="nav-item" onClick={signOut} style={{ marginTop: 'auto', cursor: 'pointer' }}>
          <span className="nav-icon">→</span>
          <span>Sign out</span>
        </div>
      </nav>

      {/* Main */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"  element={<Dashboard />} />
          <Route path="/cases"      element={<CasesPage />} />
          <Route path="/advocates"  element={<AdvocatesPage />} />
          {canViewAudit && <Route path="/audit" element={<AuditPage />} />}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  )
}
