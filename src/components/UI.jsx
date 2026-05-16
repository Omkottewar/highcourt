import { useState, useEffect, useRef } from 'react'

// ── Spinner ────────────────────────────────────────────────────────────────
export function Spinner({ size = 20 }) {
  return <div className="spinner" style={{ width: size, height: size }} />
}

// ── Modal ──────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, size = '720px' }) {
  useEffect(() => {
    if (!open) return
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: size }}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose} style={{ padding: '6px 10px' }}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

// ── Autocomplete ───────────────────────────────────────────────────────────
export function Autocomplete({ value, onChange, onSelect, fetchOptions, placeholder, labelKey = 'label' }) {
  const [options, setOptions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const timer = useRef()
  const wrapRef = useRef()

  useEffect(() => {
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const doFetch = (val) => {
    setLoading(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const data = await fetchOptions(val)
      setOptions(data || [])
      setOpen(true)
      setLoading(false)
    }, 280)
  }

  const handleInput = e => {
    const val = e.target.value
    onChange(val)
    if (val.length < 2) { setOptions([]); setOpen(false); return }
    doFetch(val)
  }

  const handleFocus = () => {
    if (options.length) { setOpen(true); return }
    doFetch(value || '')
  }

  return (
    <div className="autocomplete-wrap" ref={wrapRef}>
      <div style={{ position: 'relative' }}>
        <input className="form-input" value={value} onChange={handleInput}
          placeholder={placeholder} onFocus={handleFocus} />
        {loading && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}><Spinner size={14} /></div>}
      </div>
      {open && options.length > 0 && (
        <div className="autocomplete-list">
          {options.map((opt, i) => (
            <div key={i} className="autocomplete-item" onMouseDown={() => { onSelect(opt); setOpen(false) }}>
              {typeof opt === 'string' ? opt : opt[labelKey]}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Searchable filter dropdown ─────────────────────────────────────────────
export function FilterSelect({ value, onChange, options = [], placeholder = 'All', minWidth = 140 }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const wrapRef = useRef()

  useEffect(() => {
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = q
    ? options.filter(o => o.toLowerCase().includes(q.toLowerCase()))
    : options

  const select = (val) => { onChange(val); setOpen(false); setQ('') }

  return (
    <div className="filter-select" ref={wrapRef} style={{ minWidth }}>
      <button type="button" className="form-select filter-select-btn"
        onClick={() => setOpen(o => !o)}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || placeholder}</span>
        <span className="filter-select-caret">▾</span>
      </button>
      {open && (
        <div className="filter-select-panel">
          <input className="form-input filter-select-search" autoFocus
            value={q} onChange={e => setQ(e.target.value)} placeholder="Type to filter…" />
          <div className="filter-select-list">
            <div className={`filter-select-item ${!value ? 'active' : ''}`}
              onClick={() => select('')}>{placeholder}</div>
            {filtered.map(o => (
              <div key={o} className={`filter-select-item ${o === value ? 'active' : ''}`}
                onClick={() => select(o)}>{o}</div>
            ))}
            {filtered.length === 0 && <div className="filter-select-empty">No matches</div>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Case type badge ────────────────────────────────────────────────────────
export function CaseBadge({ type }) {
  const map = { WP: 'badge-wp', CP: 'badge-cp', PIL: 'badge-pil' }
  return <span className={`badge ${map[type] || 'badge-other'}`}>{type || '—'}</span>
}

// ── Alert ──────────────────────────────────────────────────────────────────
export function Alert({ type = 'info', children }) {
  const icons = { error: '✕', success: '✓', info: 'ℹ' }
  return <div className={`alert alert-${type}`}><span>{icons[type]}</span>{children}</div>
}

// ── Confirm dialog ─────────────────────────────────────────────────────────
export function Confirm({ open, onClose, onConfirm, title, message, danger }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="440px"
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>Confirm</button>
      </>}>
      <p style={{ fontSize: 14, color: 'var(--text-mid)', lineHeight: 1.6 }}>{message}</p>
    </Modal>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────
export function EmptyState({ icon = '📄', text = 'No records found' }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><div className="empty-text">{text}</div></div>
}

// ── Pagination ─────────────────────────────────────────────────────────────
export function Pagination({ page, total, pageSize, onChange }) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null
  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i)
  return (
    <div className="pagination">
      <button className="page-btn" onClick={() => onChange(page - 1)} disabled={page === 0}>‹</button>
      {pages.map(p => (
        <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => onChange(p)}>{p + 1}</button>
      ))}
      {totalPages > 7 && <span className="page-info">… {totalPages}</span>}
      <button className="page-btn" onClick={() => onChange(page + 1)} disabled={page >= totalPages - 1}>›</button>
      <span className="page-info">{total} total</span>
    </div>
  )
}
