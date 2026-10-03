import { useState, useEffect } from 'react'
import { Modal, Autocomplete, Alert, Spinner, SearchableInput } from './UI'
import { getAdvocates, createCase, updateCase, getNextRegdNo, getCaseTypeOptions, getDistrictOptions, getTitleOptions, addMaster } from '../lib/database'
import { splitRespondents, respondentNumbers, caseTitle } from '../utils/respondents'

const emptyForm = () => ({
  RegdNo: '', CYear: String(new Date().getFullYear()), Petitioner: '',
  Type: '', District: '', Dated: new Date().getFullYear() + '-' + String(new Date().getMonth()+1).padStart(2,'0') + '-' + String(new Date().getDate()).padStart(2,'0'), Copies: '1', RespndentNo: '',
  Adv: '', AdvMoNo: '', Remark: '', LongType: '', Title: '', PdfName: '', CaseNumber: '',
})

function AddMasterDialog({ kind, initialName = '', onClose, onSaved }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState(initialName)
  const [mobile, setMobile] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const label = { title: 'title', type: 'case type', advocate: 'advocate' }[kind]

  const handleSave = async () => {
    setSaving(true); setError('')
    const payload = { kind, code, name, mo_no: mobile }
    const { error: e, data } = await addMaster(payload)
    setSaving(false)
    if (e) { setError(e.message); return }
    onSaved(data)
    onClose()
  }

  return (
    <Modal open onClose={onClose} size="440px" title={`Add ${label}`}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
          {saving ? <Spinner size={14} /> : `Save ${label}`}
        </button>
      </>}>
      {error && <Alert type="error">{error}</Alert>}
      {kind === 'title' && (
        <div className="form-group">
          <label className="form-label">Short code<span className="req">*</span></label>
          <input className="form-input" autoFocus value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. WP" />
          <span className="form-hint">Saved in upper case so it matches existing titles.</span>
        </div>
      )}
      {kind === 'type' && (
        <>
          <div className="form-group">
            <label className="form-label">Short code<span className="req">*</span></label>
            <input className="form-input" autoFocus value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. WP" />
          </div>
          <div className="form-group">
            <label className="form-label">Full form<span className="req">*</span></label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Writ Petition" />
          </div>
        </>
      )}
      {kind === 'advocate' && (
        <>
          <div className="form-group">
            <label className="form-label">Advocate name<span className="req">*</span></label>
            <input className="form-input" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
          </div>
          <div className="form-group">
            <label className="form-label">Mobile number</label>
            <input className="form-input" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="e.g. 9405146880" />
          </div>
        </>
      )}
    </Modal>
  )
}

export default function CaseForm({ open, onClose, onSaved, editCase }) {
  const [form, setForm]           = useState(emptyForm)
  const [numbers, setNumbers] = useState(['1'])
  const [titles, setTitles] = useState([])
  const [pdf, setPdf] = useState(null)
  const [readingPdf, setReadingPdf] = useState(false)
  const [addMasterKind, setAddMasterKind] = useState(null)
  const [addMasterName, setAddMasterName] = useState('')
  const [respondents, setRespondents] = useState([''])
  const [caseTypeOptions, setCaseTypeOptions] = useState([])
  const [districtOptions, setDistrictOptions] = useState([])
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [advInput, setAdvInput]   = useState('')
  const [regdNoLoading, setRegdNoLoading] = useState(false)

  useEffect(() => {
    getTitleOptions().then(({ data }) => setTitles(data || []))
    getCaseTypeOptions().then(({ data }) => setCaseTypeOptions(data || []))
    getDistrictOptions().then(({ data }) => setDistrictOptions(data || []))
  }, [open])

  useEffect(() => {
    if (!open) return
    setPdf(null)
    setAddMasterKind(null)
    if (editCase) {
      setForm({
        RegdNo: editCase.RegdNo ?? '', CYear: editCase.CYear ?? '',
        Petitioner: editCase.Petitioner || '', Type: editCase.Type || '',
        District: editCase.District || '', Dated: editCase.Dated || '',
        Copies: editCase.Copies || '', RespndentNo: editCase.RespndentNo || '',
        Adv: editCase.Adv || '', AdvMoNo: editCase.AdvMoNo || '',
        Remark: editCase.Remark || '',
        LongType: editCase.LongType || '', Title: caseTitle(editCase), PdfName: editCase.PdfName || '',
        CaseNumber: editCase.CaseNumber || '',
      })
      setAdvInput(editCase.Adv || '')
      const list = splitRespondents(editCase.Respondets)
      setRespondents(list.length ? list : [''])
      setNumbers(list.length ? respondentNumbers(editCase) : ['1'])
    } else {
      setForm(emptyForm())
      setNumbers(['1'])
      setAdvInput('')
      setRespondents([''])
      setRegdNoLoading(true)
      getNextRegdNo().then(n => {
        setForm(f => ({ ...f, RegdNo: String(n) }))
        setRegdNoLoading(false)
      }).catch(err => { setError(err.message); setRegdNoLoading(false) })
    }
    setError('')
  }, [open, editCase])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const addRespondent = () => { setRespondents(r => [...r, '']); setNumbers(n => [...n, String(Math.max(0,...n.map(Number))+1)]) }
  const setResp = (i, val) => setRespondents(r => r.map((x, idx) => idx === i ? val : x))
  const removeResp = i => { setRespondents(r => r.filter((_, idx) => idx !== i)); setNumbers(n => n.filter((_,idx) => idx !== i)) }

  const validate = () => {
    if (!String(form.RegdNo).trim()) return 'Registration number is required'
    if (!form.Petitioner.trim())     return 'Petitioner name is required'
    if (!form.Title.trim()) return 'Title is required'
    if (respondents.some((r,i) => r.trim() && (!/^[0-9]+$/.test(numbers[i]) || Number(numbers[i]) < 1))) return 'Enter a positive whole number for each respondent'
    if (!form.Type.trim())           return 'Case type is required'
    if (!form.District.trim())       return 'District is required'
    if (!form.Dated)                 return 'Date is required'
    if (form.CaseNumber && (!/^\d+$/.test(form.CaseNumber.trim()) || Number(form.CaseNumber) <= 0)) return 'Case number must be a positive whole number'
    return null
  }

  const previewLine = () => {
    const title = form.Title.trim()
    if (!title) return ''
    const num = form.CaseNumber?.trim() ? form.CaseNumber.trim() : '________'
    const yearSuffix = form.CaseNumber?.trim() ? (form.CYear?.trim() || '20') : '20'
    return `${title} NO. ${num}/${yearSuffix}`
  }

  const handleSave = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    setSaving(true)

    const cleanResp = respondents.map(r => r.trim()).filter(Boolean)
    const payload = {
      Title: form.Title.trim(),
      RespondentNumbers: JSON.stringify(numbers.filter((_,i) => respondents[i].trim())),
      PdfName: pdf?.name || form.PdfName || null,
      ...(pdf ? { PdfBytes: pdf.bytes } : {}),
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
      AdvAddress: null,
      Remark: form.Remark.trim() || null,
      LongType: form.LongType.trim() || null,
      CaseNumber: form.CaseNumber?.trim() || null,
    }

    const { error: e } = editCase
      ? await updateCase({ id: editCase.id, RegdNo: editCase.RegdNo, CYear: editCase.CYear }, payload)
      : await createCase(payload)

    if (e) { setError(e.message); setSaving(false); return }

    setSaving(false)
    onSaved?.()
    onClose()
  }

  const openAddMaster = (kind, prefill = '') => { setAddMasterName(prefill); setAddMasterKind(kind) }

  const handleMasterSaved = async data => {
    if (addMasterKind === 'title') {
      const { data: list } = await getTitleOptions()
      setTitles(list || [])
      set('Title', data.code)
    } else if (addMasterKind === 'type') {
      const { data: list } = await getCaseTypeOptions()
      setCaseTypeOptions(list || [])
      set('Type', data.code); set('LongType', data.name || '')
    } else if (addMasterKind === 'advocate') {
      set('Adv', data.name); setAdvInput(data.name)
      if (data.mo_no) set('AdvMoNo', data.mo_no)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="800px"
      title={editCase ? `Edit Case — ${editCase.RegdNo}` : 'New Case Entry'}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-gold" onClick={handleSave} disabled={saving || readingPdf || regdNoLoading}>
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
          <label className="form-label">Title<span className="req">*</span></label>
          <select className="form-input" aria-label="Title" value={form.Title} onChange={e => set('Title',e.target.value)}>
            <option value="">Choose title</option>
            {[...new Set([...titles,form.Title].filter(Boolean))].map(t => <option key={t}>{t}</option>)}
          </select>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openAddMaster('title')}>+ Add title</button>
        </div>
        <div className="form-group">
          <label className="form-label">PDF case-number line</label>
          <input className="form-input" value={previewLine()} readOnly placeholder="WP NO. ______________/20" />
        </div>
      </div>

      <div className="form-row form-row-2">
        <div className="form-group">
          <label className="form-label">Case type<span className="req">*</span></label>
          <select className="form-input" aria-label="Case type"
            value={form.Type ? `${form.Type}|${form.LongType || ''}` : ''}
            onChange={e => {
              const [short = '', long = ''] = e.target.value.split('|')
              set('Type', short); set('LongType', long)
            }}>
            <option value="">Choose case type</option>
            {form.Type && !caseTypeOptions.some(t => t.short_type === form.Type && (t.long_type || '') === (form.LongType || '')) &&
              <option value={`${form.Type}|${form.LongType || ''}`}>{form.LongType ? `${form.Type} - ${form.LongType}` : form.Type}</option>}
            {caseTypeOptions.map(t => <option key={t.id} value={`${t.short_type}|${t.long_type || ''}`}>{t.short_type === t.long_type ? t.long_type : `${t.short_type} - ${t.long_type}`}</option>)}
          </select>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openAddMaster('type')}>+ Add type</button>
        </div>
        <div className="form-group">
          <label className="form-label">District<span className="req">*</span></label>
          <SearchableInput value={form.District} onChange={v => set('District', v)}
            options={districtOptions} labelKey="name" placeholder="Choose or enter district" />
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
            }}
            fetchOptions={async q => { const { data } = await getAdvocates(q); return data || [] }}
            placeholder="Search advocate…"
            labelKey="name"
          />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openAddMaster('advocate', advInput)}>+ Add advocate</button>
          <span className="form-hint">Select an advocate or enter a new name</span>
        </div>
        <div className="form-group">
          <label className="form-label">Advocate mobile</label>
          <input className="form-input" value={form.AdvMoNo}
            onChange={e => set('AdvMoNo', e.target.value)} placeholder="9405146880" />
        </div>
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
          <label className="form-label">Case number {!editCase && <span className="form-hint" style={{display:'inline',marginLeft:6}}>(available after save)</span>}</label>
          <input className="form-input" type="number" inputMode="numeric" min="1" step="1"
            value={form.CaseNumber || ''} disabled={!editCase}
            onChange={e => set('CaseNumber', e.target.value.replace(/[^0-9]/g, ''))}
            placeholder={editCase ? 'e.g. 7373' : 'Save the case first, then enter the court-assigned number here'} />
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <label className="form-label" style={{ margin: 0 }}>Respondents</label>
          <button className="btn btn-ghost btn-sm" type="button" onClick={addRespondent}>+ Add respondent</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {respondents.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <input className="form-input" aria-label={`Respondent ${i+1} number`} type="number" min="1" step="1" style={{width:80}} value={numbers[i] || ''} onChange={e => setNumbers(n => n.map((x,j) => j === i ? e.target.value : x))} />
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
        <span className="form-hint">Add each respondent separately so they appear clearly in case sheets and exports.</span>
      </div>

      <div className="form-group" style={{ marginTop: 16 }}>
        <label className="form-label">Case PDF</label>
        <span className="form-hint">{pdf?.name || form.PdfName || 'No PDF attached'}. Selecting a PDF replaces the existing attachment when you save. Maximum 50 MB.</span>
        <input type="file" accept=".pdf,application/pdf" onChange={async e => {
          const file=e.target.files[0]; if (!file) return
          setReadingPdf(true)
          try {
            if (file.size > 50*1024*1024) throw new Error('PDF must be 50 MB or smaller.')
            const bytes=await file.arrayBuffer()
            if (new TextDecoder().decode(bytes.slice(0,5)) !== '%PDF-') throw new Error('Choose a valid PDF file.')
            setPdf({name:file.name,bytes}); setError('')
          } catch(err) { setError(err.message); e.target.value='' }
          finally { setReadingPdf(false) }
        }} />
      </div>

      <div className="form-group" style={{ marginTop: 16 }}>
        <label className="form-label">Remark</label>
        <textarea className="form-textarea" value={form.Remark}
          onChange={e => set('Remark', e.target.value)} style={{ minHeight: 60 }} />
      </div>

      {addMasterKind && (
        <AddMasterDialog kind={addMasterKind} initialName={addMasterName}
          onClose={() => setAddMasterKind(null)} onSaved={handleMasterSaved} />
      )}
    </Modal>
  )
}
