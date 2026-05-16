import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CasesPage from './pages/Cases'
import './index.css'

function AppShell() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-logo">
          ⚖ Office of the Government Pleader
          <span>High Court of Bombay · Bench at Nagpur</span>
        </div>
      </header>

      <main className="main-content">
        <Routes>
          <Route path="/cases" element={<CasesPage />} />
          <Route path="*" element={<Navigate to="/cases" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
