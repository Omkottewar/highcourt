import { useState, useEffect } from 'react'
import { Modal, Autocomplete, Alert, Spinner, FilterSelect } from './UI'
import { getAdvocates, createCase, updateCase, getNextRegdNo, getCaseTypeOptions, getDistrictOptions } from '../lib/supabase'
import { splitRespondents } from '../utils/respondents'

const EMPTY = {
  RegdNo: '', CYear: String(new Date().getFullYear()), Petitioner: '',
  Type: '', District: '', Dated: '', Copies: '1', RespndentNo: '',
  Adv: '', AdvMoNo: '', AdvAddress: '', Remark: '', LongType: '',
}

const isWritPetition = (typeLabel) => /writ\s*petition/i.test(typeLabel || '')
// Fixed suffix "/20" — the clerk writes the remaining year digits by hand.
const WP_LONG_TYPE = 'WP NO. ______________/20'

export default function CaseForm({ open, onClose, onSaved, editCase }) {
  const [form, setForm]           = useState(EMPTY)
  const [respondents, setRespondents] = useState([''])
  const [caseTypeOptions, setCaseTypeOptions] = useState([])
  const [districtOptions, setDistrictOptions] = useState([])
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [advInput, setAdvInput]   = useState('')
  const [regdNoLoading, setRegdNoLoading] = useState(false)

  useEffect(() => {
    getCaseTypeOptions().then(({ data }) => setCaseTypeOptions(data || []))
    getDistrictOptions().then(({ data }) => setDistrictOptions(data || []))
  }, [])

  useEffect(() => {
    if (!open) return
    if (editCase) {
      setForm({
        RegdNo: editCase.RegdNo ?? '', CYear: editCase.CYear ?? '',
        Petitioner: editCase.Petitioner || '', Type: editCase.Type || '',
        District: editCase.District || '', Dated: editCase.Dated || '',
        Copies: editCase.Copies || '', RespndentNo: editCase.RespndentNo || '',
        Adv: editCase.Adv || '', AdvMoNo: editCase.AdvMoNo || '',
        AdvAddress: editCase.AdvAddress || '', Remark: editCase.Remark || '',
        LongType: editCase.LongType || '',
      })
      setAdvInput(editCase.Adv || '')
      const list = splitRespondents(editCase.Respondets)
      setRespondents(list.length ? list : [''])
    } else {
      setForm(EMPTY)
      setAdvInput('')
      setRespondents([''])
      setRegdNoLoading(true)
      getNextRegdNo().then(n => {
        setForm(f => ({ ...f, RegdNo: String(n) }))
        setRegdNoLoading(false)
      })
    }
    setError('')
  }, [open, editCase])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const addRespondent = () => setRespondents(r => [...r, ''])
  const setResp = (i, val) => setRespondents(r => r.map((x, idx) => idx === i ? val : x))
  const removeResp = i => setRespondents(r => r.filter((_, idx) => idx !== i))

  const validate = () => {
    if (!String(form.RegdNo).trim()) return 'Registration number is required'
    if (!form.Petitioner.trim())     return 'Petitioner name is required'
    if (!form.Type.trim())           return 'Case type is required'
    if (!form.District.trim())       return 'District is required'
    if (!form.Dated)                 return 'Date is required'
    return null
  }

  const handleSave = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    setSaving(true)

    const cleanResp = respondents.map(r => r.trim()).filter(Boolean)
    const payload = {
      RegdNo: parseInt(form.RegdNo, 10),
      CYear: String(form.CYear).trim() || null,
      Petitioner: form.Petitioner.trim().toUpperCase(),
      Respondets: cleanResp.length ? cleanResp.map(r => r.toUpperCase()).join('.,') : null,
      Type: form.Type.trim() || null,
      District: form.District.trim() || null,
      Dated: form.Dated || null,
      Copies: String(form.Copies).trim() || null,
      RespndentNo: form.RespndentNo.trim() || null,
      Adv: form.Adv.trim().toUpperCase() || null,
      AdvMoNo: form.AdvMoNo.trim() || null,
      AdvAddress: form.AdvAddress.trim().toUpperCase() || null,
      Remark: form.Remark.trim() || null,
      LongType: form.LongType.trim() || null,
    }

    const { error: e } = editCase
      ? await updateCase({ RegdNo: editCase.RegdNo, CYear: editCase.CYear }, payload)
      : await createCase(payload)

    if (e) { setError(e.message); setSaving(false); return }

    setSaving(false)
    onSaved?.()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} size="800px"
      title={editCase ? `Edit Case — ${editCase.RegdNo}` : 'New Case Entry'}
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
            <input className="form-input" type="number" value={regdNoLoading ? '' : form.RegdNo}
              readOnly={!editCase}
              onChange={editCase ? e => set('RegdNo', e.target.value) : undefined}
              placeholder={regdNoLoading ? 'Generating…' : ''}
              style={!editCase ? { background: 'var(--bg-alt, #f5f5f5)', cursor: 'default' } : {}} />
            {!editCase && !regdNoLoading && (
              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                fontSize: 10, fontWeight: 600, color: 'var(--gold)', letterSpacing: '0.05em' }}>AUTO</span>
            )}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Year</label>
          <input className="form-input" type="number" value={form.CYear}
            onChange={e => set('CYear', e.target.value)} min="1900" max="2099" />
        </div>
        <div className="form-group">
          <label className="form-label">Date filed<span className="req">*</span></label>
          <input className="form-input" type="date" value={form.Dated}
            onChange={e => set('Dated', e.target.value)} />
        </div>
      </div>

      <div className="form-row form-row-2">
        <div className="form-group">
          <label className="form-label">Case type<span className="req">*</span></label>
          <FilterSelect
            value={form.Type}
            placeholder="Select case type…"
            options={caseTypeOptions.map(t => t.long_type || t.short_type).filter(Boolean)}
            onChange={val => setForm(f => ({
              ...f,
              Type: val,
              LongType: isWritPetition(val) ? WP_LONG_TYPE : f.LongType,
            }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">District<span className="req">*</span></label>
          <select className="form-select" value={form.District}
            onChange={e => set('District', e.target.value)}>
            <option value="">Select district…</option>
            {districtOptions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            {form.District && !districtOptions.some(d => d.name === form.District) && (
              <option value={form.District}>{form.District}</option>
            )}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Petitioner<span className="req">*</span></label>
        <input className="form-input" value={form.Petitioner}
          onChange={e => set('Petitioner', e.target.value)}
          placeholder="SHRI RITESH SHIVRAJ VAIRAGADE" />
      </div>

      <div className="form-row form-row-2">
        <div className="form-group">
          <label className="form-label">Advocate</label>
          <Autocomplete
            value={advInput}
            onChange={v => { setAdvInput(v); set('Adv', v) }}
            onSelect={opt => {
              setAdvInput(opt.name)
              set('Adv', opt.name)
              if (opt.mo_no) set('AdvMoNo', opt.mo_no)
              if (opt.address) set('AdvAddress', opt.address)
            }}
            fetchOptions={async q => { const { data } = await getAdvocates(q); return data || [] }}
            placeholder="Search advocate…"
            labelKey="name"
          />
          <span className="form-hint">Type to search the advocate master, or enter a name directly</span>
        </div>
        <div className="form-group">
          <label className="form-label">Advocate mobile</label>
          <input className="form-input" value={form.AdvMoNo}
            onChange={e => set('AdvMoNo', e.target.value)} placeholder="9405146880" />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Advocate address</label>
        <input className="form-input" value={form.AdvAddress}
          onChange={e => set('AdvAddress', e.target.value)} />
      </div>

      <div className="form-row form-row-3">
        <div className="form-group">
          <label className="form-label">No. of copies</label>
          <input className="form-input" type="number" value={form.Copies} min="0" max="99"
            onChange={e => set('Copies', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Copy received for Resp. No.</label>
          <input className="form-input" value={form.RespndentNo}
            onChange={e => set('RespndentNo', e.target.value)} placeholder="1 , 2" />
        </div>
        <div className="form-group">
          <label className="form-label">Long type</label>
          <input className="form-input" value={form.LongType}
            onChange={e => set('LongType', e.target.value)} placeholder="WP NO. ______________/20" />
        </div>
      </div>

      {/* Respondents */}
      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <label className="form-label" style={{ margin: 0 }}>Respondents</label>
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
                <input className="form-input" value={r}
                  onChange={e => setResp(i, e.target.value)}
                  placeholder={`Respondent ${i + 1} name…`} />
              </div>
              {respondents.length > 1 && (
                <button className="btn btn-ghost btn-icon btn-sm" type="button"
                  onClick={() => removeResp(i)} style={{ marginTop: 4, color: 'var(--red)' }}>✕</button>
              )}
            </div>
          ))}
        </div>
        <span className="form-hint">Each respondent is stored together, separated by ".,"</span>
      </div>

      <div className="form-group" style={{ marginTop: 16 }}>
        <label className="form-label">Remark</label>
        <textarea className="form-textarea" value={form.Remark}
          onChange={e => set('Remark', e.target.value)} style={{ minHeight: 60 }} />
      </div>
    </Modal>
  )
}
