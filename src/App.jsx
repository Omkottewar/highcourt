import { useState, useEffect } from 'react'
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import '@fontsource-variable/inter'
import '@fontsource-variable/manrope'
import CasesPage from './pages/Cases'
import UsersPage from './pages/Users'
import EditLogPage from './pages/EditLog'
import Setup from './components/Setup'
import Login from './components/Login'
import CreateFirstAdmin from './components/CreateFirstAdmin'
import { fetchMe, logout, hasAnyAdmin } from './lib/database'
import { Spinner } from './components/UI'
import './index.css'

export default function App() {
  const mode = window.desktop?.mode
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsFirstAdmin, setNeedsFirstAdmin] = useState(false)

  useEffect(() => {
    if (!window.desktop) { setLoading(false); return }
    if (mode == null) { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      try {
        const existing = await fetchMe()
        if (cancelled) return
        if (existing) { setUser(existing); setLoading(false); return }
        if (mode === 'main') {
          const anyAdmin = await hasAnyAdmin()
          if (cancelled) return
          setNeedsFirstAdmin(!anyAdmin)
        }
      } finally { if (!cancelled) setLoading(false) }
    })()
    const onUnauth = () => { setUser(null) }
    window.addEventListener('courtdesk-unauthenticated', onUnauth)
    return () => { cancelled = true; window.removeEventListener('courtdesk-unauthenticated', onUnauth) }
  }, [mode])

  const handleSignOut = async () => {
    await logout()
    setUser(null)
  }

  const handleSignedIn = u => {
    setUser(u)
    setNeedsFirstAdmin(false)
  }

  if (!window.desktop) {
    return <main style={{ maxWidth: 600, margin: '15vh auto', padding: 32 }}>
      <h1>Open CourtDesk desktop</h1>
      <p>Your case database is stored on this computer. Open the installed Windows application to manage your records.</p>
      <p>For development, run <code>npm run desktop</code>.</p>
    </main>
  }

  if (loading) return <div className="setup-shell"><Spinner size={28} /></div>
  if (mode == null) return <Setup />
  if (!user) {
    if (mode === 'main' && needsFirstAdmin) return <CreateFirstAdmin onCreated={handleSignedIn} />
    return <Login onSignedIn={handleSignedIn} />
  }

  const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter
  const adminOnly = node => (user?.role === 'admin' ? node : <Navigate to="/cases" replace />)
  return <Router><Routes>
    <Route path="/cases" element={<CasesPage user={user} onSignOut={handleSignOut} />} />
    <Route path="/users" element={adminOnly(<UsersPage />)} />
    <Route path="/edit-log" element={adminOnly(<EditLogPage />)} />
    <Route path="*" element={<Navigate to="/cases" replace />} />
  </Routes></Router>
}
