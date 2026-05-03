import { useState, useEffect } from 'react'
import { Modal, Autocomplete, Alert, Spinner } from '../components/UI'
import {
  getAdvocates, getDepartments,
  createCase, updateCase, getNextRegdNo
} from '../lib/supabase'
import { supabase } from '../lib/supabase'

const EMPTY = {
  regd_no: '', cyear: new Date().getFullYear(), petitioner: '',
  case_type_id: '', district_id: '', dated: '', copies: 1,
  wp_number: '', adv_name_raw: '', advocate_id: null,
}

export default function CaseForm({ open, onClose, onSaved, editCase, districts = [], caseTypes = [] }) {
  const [form, setForm]           = useState(EMPTY)
  const [respondents, setRespondents] = useState([{ resp_no: 1, resp_name_raw: '', dept_id: null }])
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [advInput, setAdvInput]   = useState('')
  const [regdNoLoading, setRegdNoLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editCase) {
      const advName = editCase.adv_name_raw || editCase.advocate_name || ''
      setForm({
        regd_no: editCase.regd_no || '', cyear: editCase.cyear || new Date().getFullYear(),
        petitioner: editCase.petitioner || '', case_type_id: editCase.case_type_id || '',
        district_id: editCase.district_id || '', dated: editCase.dated || '',
        copies: editCase.copies || 1, wp_number: editCase.wp_number || '',
        adv_name_raw: advName, advocate_id: editCase.advocate_id || null,
      })
      setAdvInput(advName)
      // Load respondents for this case
      supabase.from('case_respondents')
        .select('*, departments(full_name)')
        .eq('case_id', editCase.id)
        .order('resp_no')
        .then(({ data }) => {
          if (data?.length) setRespondents(data.map(r => ({
            resp_no: r.resp_no,
            resp_name_raw: r.departments?.full_name || r.resp_name_raw || '',
            dept_id: r.dept_id,
          })))
        })
    } else {
      setForm(EMPTY)
      setAdvInput('')
      setRespondents([{ resp_no: 1, resp_name_raw: '', dept_id: null }])
      setRegdNoLoading(true)
      getNextRegdNo(EMPTY.cyear).then(n => {
        setForm(f => ({ ...f, regd_no: n }))
        setRegdNoLoading(false)
      })
    }
    setError('')
  }, [open, editCase])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const addRespondent = () =>
    setRespondents(r => [...r, { resp_no: r.length + 1, resp_name_raw: '', dept_id: null }])

  const setResp = (i, field, val) =>
    setRespondents(r => r.map((x, idx) => idx === i ? { ...x, [field]: val } : x))

  const removeResp = i =>
    setRespondents(r => r.filter((_, idx) => idx !== i).map((x, idx) => ({ ...x, resp_no: idx + 1 })))

  const validate = () => {
    if (!form.regd_no) return 'Registration number is required'
    if (!form.petitioner.trim()) return 'Petitioner name is required'
    if (!form.case_type_id) return 'Case type is required'
    if (!form.district_id)  return 'District is required'
    if (!form.dated)         return 'Date is required'
    if (respondents.some(r => !r.resp_name_raw.trim())) return 'All respondent fields must be filled'
    return null
  }

  const handleSave = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    setSaving(true)

    const caseData = {
      regd_no: parseInt(form.regd_no),
      cyear: parseInt(form.cyear),
      petitioner: form.petitioner.trim().toUpperCase(),
      case_type_id: parseInt(form.case_type_id),
      district_id: parseInt(form.district_id),
      dated: form.dated,
      copies: parseInt(form.copies) || 1,
      wp_number: form.wp_number.trim() || null,
      adv_name_raw: form.adv_name_raw.trim().toUpperCase() || null,
      advocate_id: form.advocate_id || null,
    }

    let caseId
    if (editCase) {
      const { data, error: e } = await updateCase(editCase.id, caseData)
      if (e) { setError(e.message); setSaving(false); return }
      caseId = editCase.id
    } else {
      const { data, error: e } = await createCase(caseData)
      if (e) { setError(e.message); setSaving(false); return }
      caseId = data.id
    }

    // Upsert respondents — delete old then insert new
    await supabase.from('case_respondents').delete().eq('case_id', caseId)
    const respRows = respondents.map(r => ({
      case_id: caseId,
      resp_no: r.resp_no,
      resp_name_raw: r.resp_name_raw.trim().toUpperCase(),
      dept_id: r.dept_id || null,
    }))
    const { error: re } = await supabase.from('case_respondents').insert(respRows)
    if (re) { setError(re.message); setSaving(false); return }

    setSaving(false)
    onSaved?.()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} size="800px"
      title={editCase ? `Edit Case — ${editCase.regd_no}/${editCase.cyear}` : 'New Case Entry'}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
          {saving ? <Spinner size={15} /> : (editCase ? 'Save Changes' : 'Create Case')}
        </button>
      </>}>

      {error && <Alert type="error">{error}</Alert>}

      <div className="form-row form-row-3">
        <div className="form-group">
          <label className="form-label">Regd. No.<span className="req">*</span></label>
          <div style={{ position: 'relative' }}>
            <input className="form-input" type="number" value={regdNoLoading ? '' : form.regd_no}
              readOnly={!editCase}
              onChange={editCase ? e => set('regd_no', e.target.value) : undefined}
              placeholder={regdNoLoading ? 'Generating…' : ''}
              style={!editCase ? { background: 'var(--bg-alt, #f5f5f5)', cursor: 'default' } : {}} />
            {!editCase && !regdNoLoading && (
              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                fontSize: 10, fontWeight: 600, color: 'var(--gold)', letterSpacing: '0.05em' }}>AUTO</span>
            )}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Year<span className="req">*</span></label>
          <input className="form-input" type="number" value={form.cyear}
            onChange={e => {
              const yr = e.target.value
              set('cyear', yr)
              if (!editCase && yr.length === 4) {
                setRegdNoLoading(true)
                getNextRegdNo(parseInt(yr)).then(n => {
                  setForm(f => ({ ...f, regd_no: n }))
                  setRegdNoLoading(false)
                })
              }
            }} min="1990" max="2099" />
        </div>
        <div className="form-group">
          <label className="form-label">Date filed<span className="req">*</span></label>
          <input className="form-input" type="date" value={form.dated}
            onChange={e => set('dated', e.target.value)} />
        </div>
      </div>

      <div className="form-row form-row-2">
        <div className="form-group">
          <label className="form-label">Case type<span className="req">*</span></label>
          <select className="form-select" value={form.case_type_id}
            onChange={e => set('case_type_id', e.target.value)}>
            <option value="">Select type…</option>
            {caseTypes.map(t => <option key={t.id} value={t.id}>{t.short_code} — {t.long_name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">District<span className="req">*</span></label>
          <select className="form-select" value={form.district_id}
            onChange={e => set('district_id', e.target.value)}>
            <option value="">Select district…</option>
            {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Petitioner<span className="req">*</span></label>
        <input className="form-input" value={form.petitioner}
          onChange={e => set('petitioner', e.target.value)}
          placeholder="SHRI RITESH SHIVRAJ VAIRAGADE" />
      </div>

      <div className="form-row form-row-2">
        <div className="form-group">
          <label className="form-label">Advocate</label>
          <Autocomplete
            value={advInput}
            onChange={v => { setAdvInput(v); set('adv_name_raw', v); set('advocate_id', null) }}
            onSelect={opt => { setAdvInput(opt.full_name); set('adv_name_raw', opt.full_name); set('advocate_id', opt.id) }}
            fetchOptions={async q => { const { data } = await getAdvocates(q); return data || [] }}
            placeholder="Search advocate…"
            labelKey="full_name"
          />
          <span className="form-hint">Type to search existing advocates, or enter name directly</span>
        </div>
        <div className="form-group">
          <label className="form-label">WP / Case number</label>
          <input className="form-input" value={form.wp_number}
            onChange={e => set('wp_number', e.target.value)}
            placeholder="WP/458/2026" />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">No. of copies</label>
        <input className="form-input" type="number" value={form.copies} min="1" max="20"
          onChange={e => set('copies', e.target.value)} style={{ maxWidth: 100 }} />
      </div>

      {/* Respondents */}
      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <label className="form-label" style={{ margin: 0 }}>Respondents<span className="req">*</span></label>
          <button className="btn btn-ghost btn-sm" type="button" onClick={addRespondent}>+ Add respondent</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {respondents.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: 'var(--navy)',
                color: 'var(--gold-light)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 12, fontWeight: 500, flexShrink: 0, marginTop: 7
              }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <Autocomplete
                  value={r.resp_name_raw}
                  onChange={v => setResp(i, 'resp_name_raw', v)}
                  onSelect={opt => { setResp(i, 'resp_name_raw', opt.full_name); setResp(i, 'dept_id', opt.id) }}
                  fetchOptions={async q => { const { data } = await getDepartments(q); return data || [] }}
                  placeholder={`Respondent ${i + 1} name…`}
                  labelKey="full_name"
                />
              </div>
              {respondents.length > 1 && (
                <button className="btn btn-ghost btn-icon btn-sm" type="button"
                  onClick={() => removeResp(i)} style={{ marginTop: 4, color: 'var(--red)' }}>✕</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}
