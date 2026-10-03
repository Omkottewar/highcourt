import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import '@fontsource-variable/inter'
import '@fontsource-variable/manrope'
import CasesPage from './pages/Cases'
import './index.css'

export default function App() {
  if (!window.desktop?.database) return <main style={{ maxWidth: 600, margin: '15vh auto', padding: 32 }}><h1>Open CourtDesk desktop</h1><p>Your case database is stored on this computer. Open the installed Windows application to manage your records.</p><p>For development, run <code>npm run desktop</code>.</p></main>
  const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter
  return <Router><Routes>
    <Route path="/cases" element={<CasesPage />} />
    <Route path="*" element={<Navigate to="/cases" replace />} />
  </Routes></Router>
}
