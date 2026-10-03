import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { X, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

export function Spinner({ size = 20 }) {
  return <div className="spinner" style={{ width: size, height: size }} />
}

const modalStack = []

export function Modal({ open, onClose, title, children, footer, size = '720px' }) {
  const modalRef = useRef()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const tokenRef = useRef({})
  useEffect(() => {
    if (!open) return
    const token = tokenRef.current
    modalStack.push(token)
    const previous = document.activeElement
    const focusable = () => [...(modalRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || [])]
    const timer = setTimeout(() => {
      const autofocus = modalRef.current?.querySelector('[autofocus]')
      ;(autofocus || focusable()[0] || modalRef.current)?.focus()
    }, 0)
    const handler = e => {
      if (modalStack[modalStack.length - 1] !== token) return
      if (e.key === 'Escape') closeRef.current()
      if (e.key === 'Tab') {
        const elements = focusable(), first = elements[0], last = elements[elements.length - 1]
        if (!first) { e.preventDefault(); return }
        if (e.shiftKey && (document.activeElement === first || document.activeElement === modalRef.current)) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', handler)
    return () => {
      const idx = modalStack.indexOf(token)
      if (idx !== -1) modalStack.splice(idx, 1)
      clearTimeout(timer)
      window.removeEventListener('keydown', handler)
      previous?.focus()
    }
  }, [open])

  if (!open) return null

  const isTop = () => modalStack[modalStack.length - 1] === tokenRef.current

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && isTop()) onClose() }}>
      <div className="modal" style={{ maxWidth: size }} ref={modalRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

function useFloatingPosition(anchorRef, open, panelHeight = 260) {
  const [style, setStyle] = useState({})
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const compute = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return
      const spaceBelow = window.innerHeight - rect.bottom
      const flip = spaceBelow < panelHeight + 12 && rect.top > spaceBelow
      const maxH = Math.max(140, Math.min(panelHeight, flip ? rect.top - 12 : spaceBelow - 12))
      setStyle({
        position: 'fixed',
        left: rect.left,
        top: flip ? rect.top - maxH - 4 : rect.bottom + 4,
        width: rect.width,
        maxHeight: maxH,
        zIndex: 2000,
      })
    }
    compute()
    const onScroll = () => compute()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', compute)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', compute)
    }
  }, [open, anchorRef, panelHeight])
  return style
}

export function Autocomplete({ value, onChange, onSelect, fetchOptions, placeholder, labelKey = 'label', minChars = 2 }) {
  const [options, setOptions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const timer = useRef()
  const wrapRef = useRef()
  const inputRef = useRef()
  const floating = useFloatingPosition(inputRef, open)

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
    }, 180)
  }

  const handleInput = e => {
    const val = e.target.value
    onChange(val)
    if (val.length < minChars) {
      if (minChars === 0) doFetch(val)
      else { setOptions([]); setOpen(false) }
      return
    }
    doFetch(val)
  }

  const handleFocus = () => {
    if (minChars === 0 || options.length) { if (!options.length) doFetch(value || ''); else setOpen(true); return }
    if ((value || '').length >= minChars) doFetch(value || '')
  }

  return (
    <div className="autocomplete-wrap" ref={wrapRef}>
      <div style={{ position: 'relative' }}>
        <input ref={inputRef} className="form-input" value={value} onChange={handleInput}
          placeholder={placeholder} onFocus={handleFocus} />
        {loading && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}><Spinner size={14} /></div>}
      </div>
      {open && options.length > 0 && (
        <div className="autocomplete-list" style={floating}>
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

export function FilterSelect({ value, onChange, options = [], placeholder = 'All', minWidth = 140 }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const wrapRef = useRef()
  const btnRef = useRef()
  const floating = useFloatingPosition(btnRef, open, 300)

  useEffect(() => {
    const handler = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target) &&
          !e.target.closest?.('.filter-select-panel')) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const normalized = options.map(o => typeof o === 'string' ? { value: o, label: o } : { value: o.value, label: o.label ?? o.value })
  const filtered = q
    ? normalized.filter(o => o.label.toLowerCase().includes(q.toLowerCase()))
    : normalized
  const activeLabel = normalized.find(o => o.value === value)?.label || value

  const select = (val) => { onChange(val); setOpen(false); setQ('') }

  return (
    <div className="filter-select" ref={wrapRef} style={{ minWidth }}>
      <button ref={btnRef} type="button" className="form-select filter-select-btn"
        aria-label={placeholder} aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeLabel || placeholder}</span>
        <ChevronDown size={12} className="filter-select-caret" />
      </button>
      {open && (
        <div className="filter-select-panel" style={floating} onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); e.stopPropagation() } }}>
          <input className="form-input filter-select-search" autoFocus
            value={q} onChange={e => setQ(e.target.value)} placeholder="Type to filter…" />
          <div className="filter-select-list">
            <button type="button" className={`filter-select-item ${!value ? 'active' : ''}`}
              onClick={() => select('')}>{placeholder}</button>
            {filtered.map(o => (
              <button type="button" key={o.value} className={`filter-select-item ${o.value === value ? 'active' : ''}`}
                onClick={() => select(o.value)}>{o.label}</button>
            ))}
            {filtered.length === 0 && <div className="filter-select-empty">No matches</div>}
          </div>
        </div>
      )}
    </div>
  )
}

export function SearchableInput({ value, onChange, options = [], placeholder, labelKey = 'name' }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef()
  const inputRef = useRef()
  const floating = useFloatingPosition(inputRef, open)

  useEffect(() => {
    const handler = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target) &&
          !e.target.closest?.('.autocomplete-list')) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const q = String(value || '').toLowerCase()
  const filtered = options.filter(o => {
    const label = typeof o === 'string' ? o : o[labelKey]
    return label && label.toLowerCase().includes(q)
  })

  return (
    <div className="autocomplete-wrap" ref={wrapRef}>
      <input ref={inputRef} className="form-input" value={value || ''}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder} />
      {open && filtered.length > 0 && (
        <div className="autocomplete-list" style={floating}>
          {filtered.map((opt, i) => {
            const label = typeof opt === 'string' ? opt : opt[labelKey]
            return (
              <div key={i} className="autocomplete-item"
                onMouseDown={() => { onChange(label); setOpen(false) }}>{label}</div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function CaseBadge({ type }) {
  const map = { WP: 'badge-wp', CP: 'badge-cp', PIL: 'badge-pil' }
  const code = /writ/i.test(type || '') ? 'WP' : /criminal/i.test(type || '') ? 'CP' : /public interest/i.test(type || '') ? 'PIL' : type
  return <span className={`badge ${map[code] || 'badge-other'}`} title={type}>{type || '—'}</span>
}

export function Alert({ type = 'info', children }) {
  const icons = { error: '✕', success: '✓', info: 'ℹ' }
  return <div className={`alert alert-${type}`}><span>{icons[type]}</span>{children}</div>
}

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

export function EmptyState({ icon = '📄', text = 'No records found' }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><div className="empty-text">{text}</div></div>
}

export function Pagination({ page, total, pageSize, onChange, disabled = false }) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null
  const pages = [...new Set([0, ...Array.from({ length: 5 }, (_, i) => page + i - 2).filter(p => p >= 0 && p < totalPages), totalPages - 1])].sort((a, b) => a - b)
  return (
    <div className="pagination">
      <button aria-label="Previous page" className="page-btn" onClick={() => onChange(page - 1)} disabled={disabled || page === 0}><ChevronLeft size={13} /></button>
      {pages.map((p, i) => <span key={p} style={{ display: 'inline-flex', alignItems: 'center' }}>
        {i > 0 && p - pages[i - 1] > 1 && <span className="page-info">…</span>}
        <button aria-label={`Page ${p + 1}`} aria-current={p === page ? 'page' : undefined} disabled={disabled} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => onChange(p)}>{p + 1}</button>
      </span>)}
      <button aria-label="Next page" className="page-btn" onClick={() => onChange(page + 1)} disabled={disabled || page >= totalPages - 1}><ChevronRight size={13} /></button>
    </div>
  )
}
