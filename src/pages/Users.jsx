import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, KeyRound, UserX, UserCheck, ShieldCheck } from 'lucide-react'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { Modal, Alert, Spinner, Confirm } from '../components/UI'
import { listUsers, createUser, updateUser } from '../lib/database'

function NewUserDialog({ open, onClose, onCreated }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('clerk')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (open) { setUsername(''); setPassword(''); setRole('clerk'); setError('') } }, [open])

  const handleSave = async () => {
    setBusy(true); setError('')
    const { data, error: e } = await createUser({ username: username.trim(), password, role })
    setBusy(false)
    if (e) { setError(e.message); return }
    onCreated(data)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} size="440px" title="New user"
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-gold" onClick={handleSave} disabled={busy}>{busy ? <Spinner size={14} /> : 'Create user'}</button>
      </>}>
      {error && <Alert type="error">{error}</Alert>}
      <div className="form-group">
        <label className="form-label">Username<span className="req">*</span></label>
        <input className="form-input" autoFocus value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. clerk-sunita" />
        <span className="form-hint">3–32 characters. Letters, numbers, and <code>._-</code> only.</span>
      </div>
      <div className="form-group">
        <label className="form-label">Password<span className="req">*</span></label>
        <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" />
      </div>
      <div className="form-group">
        <label className="form-label">Role<span className="req">*</span></label>
        <select className="form-input" value={role} onChange={e => setRole(e.target.value)}>
          <option value="clerk">Clerk — can only update the court-assigned case number</option>
          <option value="admin">Admin — full access, equivalent to the main PC</option>
        </select>
      </div>
    </Modal>
  )
}

function ResetPasswordDialog({ open, user, onClose, onDone }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (open) { setPassword(''); setError('') } }, [open])

  if (!user) return null
  const handleSave = async () => {
    setBusy(true); setError('')
    const { error: e } = await updateUser(user.id, { password })
    setBusy(false)
    if (e) { setError(e.message); return }
    onDone()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} size="420px" title={`Reset password for ${user.username}`}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-gold" onClick={handleSave} disabled={busy}>{busy ? <Spinner size={14} /> : 'Reset password'}</button>
      </>}>
      {error && <Alert type="error">{error}</Alert>}
      <p className="dialog-intro">The user will be signed out of all active sessions and must sign in again with the new password.</p>
      <div className="form-group">
        <label className="form-label">New password<span className="req">*</span></label>
        <input className="form-input" type="password" autoFocus value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" />
      </div>
    </Modal>
  )
}

export default function UsersPage() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [toggleTarget, setToggleTarget] = useState(null)
  const [roleTarget, setRoleTarget] = useState(null)

  const load = async () => {
    setLoading(true); setError('')
    const { data, error: e } = await listUsers()
    if (e) setError(e.message)
    else setUsers(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const toggleEnabled = async () => {
    if (!toggleTarget) return
    const { error: e } = await updateUser(toggleTarget.id, { enabled: !toggleTarget.enabled })
    setToggleTarget(null)
    if (e) { setError(e.message); return }
    setNotice(`${toggleTarget.username} ${toggleTarget.enabled ? 'disabled' : 'enabled'}.`)
    load()
  }
  const changeRole = async () => {
    if (!roleTarget) return
    const newRole = roleTarget.role === 'admin' ? 'clerk' : 'admin'
    const { error: e } = await updateUser(roleTarget.id, { role: newRole })
    setRoleTarget(null)
    if (e) { setError(e.message); return }
    setNotice(`${roleTarget.username} is now a ${newRole}.`)
    load()
  }

  return (
    <div className="app-shell">
      <main className="main-content">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="icon-button" title="Back to cases" onClick={() => navigate('/cases')}><ArrowLeft size={18} /></button>
            <h1 className="page-title">Users<span className="title-dot">.</span></h1>
          </div>
          <div className="header-actions">
            <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={17} />New user</button>
          </div>
        </div>

        {error && <div className="alert alert-error"><span>✕</span>{error}<button className="icon-button" onClick={() => setError('')} aria-label="Dismiss"><UserX size={14} /></button></div>}
        {notice && <div className="toast"><UserCheck size={17} />{notice}<button className="icon-button" onClick={() => setNotice('')} aria-label="Dismiss"><UserX size={14} /></button></div>}

        <section className="register-panel">
          <div className="table-wrap">
            {loading ? <div className="loading-row"><Spinner /><span>Loading users…</span></div> :
             !users.length ? <div className="empty-state"><div className="empty-text">No users yet. Create one with "+ New user".</div></div> :
             <table className="resizable-table">
              <thead><tr>
                <th>Username</th><th>Role</th><th>Status</th><th>Created</th><th>Added by</th><th className="actions-heading">Actions</th>
              </tr></thead>
              <tbody>{users.map(u => <tr key={u.id} className={u.enabled ? '' : 'selected-row'}>
                <td><strong>{u.username}</strong></td>
                <td>{u.role === 'admin' ? <span className="user-pill" style={{ background: '#eaf2e4', color: '#436338' }}><ShieldCheck size={11} /> admin</span> : <span className="user-pill">clerk</span>}</td>
                <td>{u.enabled ? <span style={{ color: '#436338', fontWeight: 500 }}>Active</span> : <span style={{ color: '#a3464f', fontWeight: 500 }}>Disabled</span>}</td>
                <td style={{ fontSize: 11, color: '#6c7a89' }}>{(() => { try { return format(new Date(u.created_at), 'dd MMM yyyy, HH:mm') } catch { return u.created_at } })()}</td>
                <td style={{ fontSize: 11, color: '#6c7a89' }}>{u.created_by || '—'}</td>
                <td className="row-actions">
                  <button className="icon-button" title="Reset password" onClick={() => setResetTarget(u)}><KeyRound size={15} /></button>
                  <button className="icon-button" title={u.role === 'admin' ? 'Demote to clerk' : 'Promote to admin'} onClick={() => setRoleTarget(u)}><ShieldCheck size={15} /></button>
                  <button className="icon-button" title={u.enabled ? 'Disable account' : 'Enable account'} onClick={() => setToggleTarget(u)}>{u.enabled ? <UserX size={15} /> : <UserCheck size={15} />}</button>
                </td>
              </tr>)}</tbody>
             </table>}
          </div>
        </section>
      </main>

      <NewUserDialog open={showNew} onClose={() => setShowNew(false)} onCreated={() => { setNotice('User created.'); load() }} />
      <ResetPasswordDialog open={!!resetTarget} user={resetTarget} onClose={() => setResetTarget(null)} onDone={() => setNotice('Password reset. The user has been signed out.')} />
      <Confirm open={!!toggleTarget} onClose={() => setToggleTarget(null)} onConfirm={toggleEnabled}
        title={toggleTarget?.enabled ? 'Disable account?' : 'Enable account?'}
        message={toggleTarget?.enabled
          ? <span><strong>{toggleTarget?.username}</strong> will be signed out and unable to sign in again until you re-enable the account.</span>
          : <span>Allow <strong>{toggleTarget?.username}</strong> to sign in again?</span>}
        danger={toggleTarget?.enabled} />
      <Confirm open={!!roleTarget} onClose={() => setRoleTarget(null)} onConfirm={changeRole}
        title={roleTarget?.role === 'admin' ? 'Demote to clerk?' : 'Promote to admin?'}
        message={<span><strong>{roleTarget?.username}</strong> will become {roleTarget?.role === 'admin' ? 'a clerk and lose admin access' : 'an admin with full access'}.</span>}
        danger={roleTarget?.role === 'admin'} />
    </div>
  )
}
