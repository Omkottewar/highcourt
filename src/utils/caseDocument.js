import { format } from 'date-fns'
import { splitRespondents, respondentNumbers, caseTitle } from './respondents'

export function escapeDocumentText(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]))
}

function filingDateLabel(value) {
  if (!value || String(value).startsWith('1900-01-01')) return ''
  try { return format(new Date(value), 'dd MMMM yyyy') } catch { return '' }
}
const text = value => escapeDocumentText(value == null || String(value).trim() === '' ? '—' : value)

function shortTypeCode(row) {
  const title = String(row.Title || '').trim()
  if (title && !/\s/.test(title) && title.length <= 8) return title.toUpperCase()
  const type = String(row.Type || '').trim()
  if (!type) return title.toUpperCase()
  if (!/\s/.test(type) && type.length <= 8) return type.toUpperCase()
  return type.split(/\s+/).map(w => w[0] || '').join('').toUpperCase()
}

export function buildCaseDocument(caseData, { fontURL = '', generatedAt = new Date(), autoPrint = false } = {}) {
  const respondents = splitRespondents(caseData.Respondets)
  const respondentNos = respondentNumbers(caseData)
  const year = caseData.CYear && String(caseData.CYear) !== '0' ? caseData.CYear : ''
  const titleCode = shortTypeCode(caseData) || caseTitle(caseData) || ''
  const caseTypeLabel = (caseData.LongType || caseData.Type || '').toUpperCase()
  const safeFontURL = String(fontURL).replace(/["\\<>\r\n]/g, character => encodeURIComponent(character))
  const generatedLabel = format(new Date(generatedAt), 'dd MMM yyyy')
  const caseNumberDisplay = caseData.CaseNumber ? escapeDocumentText(caseData.CaseNumber) : '______'
  const caseYearSuffix = caseData.CaseNumber && year ? escapeDocumentText(year) : '20_____'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Case record — ${text(caseData.RegdNo)}${year ? ' — ' + text(year) : ''}</title>
  <style>
    ${fontURL ? `@font-face { font-family: 'Case Inter'; font-style: normal; font-weight: 100 900; font-display: block; src: url("${safeFontURL}") format('woff2'); }` : ''}
    @page {
      size: A4;
      margin: 0;
      @bottom-right {
        content: 'Page ' counter(page) ' of ' counter(pages);
        font-family: 'Case Inter', Arial, sans-serif; font-size: 7.5pt; color: #6c757d;
        padding: 0 14mm 6mm 0;
      }
    }
    * { box-sizing: border-box; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; background: #fff; color: #0f1619; font-family: 'Case Inter', Arial, sans-serif; font-size: 10pt; line-height: 1.5; }
    .document { width: 100%; }

    .brand-bar { background: #1b2735; color: #fff; padding: 8mm 14mm; display: flex; align-items: center; justify-content: space-between; gap: 10mm; }
    .brand-text { font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 1.45; }
    .case-ref { display: inline-flex; flex-direction: column; align-items: stretch; min-width: 46mm; }
    .case-ref-label { font-size: 7pt; letter-spacing: 2.4pt; color: #a0abb9; margin-bottom: 1.5mm; padding: 0 1mm; }
    .case-ref-value { font-size: 10.5pt; font-weight: 650; letter-spacing: .5pt; padding: 2mm 3mm; background: #fff; color: #0f1619; border: .6pt solid #fff; border-radius: 2mm; text-align: center; font-variant-numeric: tabular-nums; }

    .main { padding: 10mm 14mm 14mm 14mm; }

    .title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 10mm; margin-top: 5mm; margin-bottom: 7mm; }
    .eyebrow { font-size: 8pt; letter-spacing: 2.4pt; color: #6c7a89; margin-bottom: 2mm; }
    .document-title { font-family: Georgia, 'Times New Roman', serif; font-size: 28pt; font-weight: 700; letter-spacing: -.5pt; line-height: 1; color: #0f1619; }
    .number-badge { background: #eceff2; border-radius: 3mm; padding: 4mm 7mm; text-align: center; min-width: 36mm; }
    .number-badge-value { font-size: 20pt; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; color: #0f1619; }
    .number-badge-meta { font-size: 7.5pt; color: #6c7a89; margin-top: 2mm; letter-spacing: .3pt; }

    .meta-card { border: .6pt solid #d8dde3; border-radius: 2.5mm; overflow: hidden; margin-bottom: 7mm; }
    .meta-row { display: grid; grid-template-columns: 1fr 1fr 1fr; }
    .meta-row + .meta-row { border-top: .6pt solid #e4e8ec; }
    .meta-cell { padding: 4mm 5mm; }
    .meta-cell + .meta-cell { border-left: .6pt solid #e4e8ec; }
    .meta-label { font-size: 7pt; letter-spacing: 1.8pt; color: #7a8591; margin-bottom: 1.5mm; }
    .meta-value { font-size: 11pt; font-weight: 650; color: #0f1619; overflow-wrap: anywhere; }

    .section-block { margin-bottom: 7mm; break-inside: avoid; }
    .section-head { display: flex; align-items: baseline; gap: 3mm; margin-bottom: 3mm; }
    .section-no { font-size: 8pt; font-weight: 600; color: #7a8591; letter-spacing: 1pt; font-variant-numeric: tabular-nums; }
    .section-name { font-size: 8.5pt; font-weight: 700; color: #1b2735; letter-spacing: 2pt; }

    .party-card { padding: 1mm 0 2mm 0; border-left: 2pt solid #d8dde3; padding-left: 5mm; }
    .party-label { font-size: 7pt; letter-spacing: 1.8pt; color: #7a8591; margin-bottom: 1.5mm; }
    .party-name { font-size: 12pt; font-weight: 700; color: #0f1619; overflow-wrap: anywhere; }

    .versus-divider { display: flex; align-items: center; gap: 3mm; margin: 3mm 0 2mm 5mm; }
    .versus-divider::before, .versus-divider::after { content: ''; flex: 1; height: .4pt; background: #d8dde3; }
    .versus-divider span { font-family: Georgia, 'Times New Roman', serif; font-size: 9pt; font-style: italic; color: #7a8591; }

    .resp-head { display: grid; grid-template-columns: 10mm 1fr; gap: 4mm; padding: 2mm 0 2mm 5mm; border-bottom: .6pt solid #d8dde3; }
    .resp-head-no, .resp-head-name { font-size: 7pt; letter-spacing: 1.8pt; color: #7a8591; }
    .resp-row { display: grid; grid-template-columns: 10mm 1fr; gap: 4mm; padding: 2.5mm 0 2.5mm 5mm; border-bottom: .6pt solid #e4e8ec; break-inside: avoid; }
    .resp-row:last-child { border-bottom: none; }
    .resp-no { font-size: 10pt; color: #7a8591; font-variant-numeric: tabular-nums; }
    .resp-name { font-size: 10.5pt; font-weight: 600; color: #0f1619; overflow-wrap: anywhere; }

    .advocate-card { border: .6pt solid #d8dde3; border-radius: 2.5mm; overflow: hidden; }
    .advocate-row { display: grid; grid-template-columns: 1fr 1fr; }
    .advocate-row.single { grid-template-columns: 1fr; }
    .advocate-row + .advocate-row { border-top: .6pt solid #e4e8ec; }
    .advocate-cell { padding: 4mm 5mm; }
    .advocate-cell + .advocate-cell { border-left: .6pt solid #e4e8ec; }

    .copies-line { margin-top: 4mm; padding: 3mm 0 0 0; border-top: .6pt solid #e4e8ec; font-size: 8pt; letter-spacing: 1.8pt; color: #7a8591; }
    .copies-line b { color: #0f1619; font-size: 10.5pt; font-weight: 650; letter-spacing: 0; margin-left: 3mm; }

    .remarks { font-size: 10pt; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; color: #28333f; padding-left: 5mm; border-left: 2pt solid #d8dde3; }

    .doc-footer { margin-top: 10mm; padding: 4mm 0; border-top: .4pt solid #d8dde3; display: flex; justify-content: space-between; font-size: 7.5pt; color: #6c7a89; letter-spacing: .3pt; }

    @media screen {
      body { background: #edf0e9; padding: 8mm 0; }
      .document { width: 210mm; min-height: 297mm; margin: 0 auto; background: white; box-shadow: 0 3mm 12mm #28382018; overflow: hidden; }
    }
    @media print { .document { width: auto; margin: 0; } }
  </style>
</head>
<body>
  <main class="document">
    <header class="brand-bar">
      <div class="brand-text">Office of the Government Pleader,<br/>High Court of Bombay, Bench at Nagpur.</div>
      <div class="case-ref">
        <div class="case-ref-label">CASE REFERENCE</div>
        <div class="case-ref-value"><b>${escapeDocumentText(titleCode || '____')}</b> NO. ${caseNumberDisplay}/${caseYearSuffix}</div>
      </div>
    </header>

    <div class="main">
      <section class="title-row">
        <div class="title-stack">
          <div class="eyebrow">CASE REGISTER</div>
          <h1 class="document-title">Case record</h1>
        </div>
        <div class="number-badge">
          <div class="number-badge-value">${text(caseData.RegdNo)}</div>
          <div class="number-badge-meta">Generated ${escapeDocumentText(generatedLabel)}</div>
        </div>
      </section>

      <section class="meta-card">
        <div class="meta-row">
          <div class="meta-cell"><div class="meta-label">REGISTRATION NO.</div><div class="meta-value">${text(caseData.RegdNo)}</div></div>
          <div class="meta-cell"><div class="meta-label">CASE YEAR</div><div class="meta-value">${text(year)}</div></div>
          <div class="meta-cell"><div class="meta-label">DATE FILED</div><div class="meta-value">${text(filingDateLabel(caseData.Dated))}</div></div>
        </div>
        <div class="meta-row">
          <div class="meta-cell"><div class="meta-label">DISTRICT</div><div class="meta-value">${text((caseData.District || '').toUpperCase())}</div></div>
          <div class="meta-cell"><div class="meta-label">CASE TYPE</div><div class="meta-value">${text(caseTypeLabel)}</div></div>
          <div class="meta-cell"><div class="meta-label">COPIES RECEIVED</div><div class="meta-value">${text(caseData.Copies)}</div></div>
        </div>
      </section>

      <section class="section-block">
        <div class="section-head"><span class="section-no">01</span><span class="section-name">PARTIES TO THE CASE</span></div>
        <div class="party-card">
          <div class="party-label">PETITIONER</div>
          <div class="party-name">${text((caseData.Petitioner || '').toUpperCase())}</div>
        </div>
        <div class="versus-divider"><span>versus</span></div>
        <div class="resp-head"><div class="resp-head-no">NO.</div><div class="resp-head-name">RESPONDENTS</div></div>
        ${respondents.length
          ? respondents.map((name, index) => `<div class="resp-row"><div class="resp-no">${escapeDocumentText(String(respondentNos[index] || index + 1).padStart(2, '0'))}</div><div class="resp-name">${escapeDocumentText(name.toUpperCase())}</div></div>`).join('')
          : '<div class="resp-row"><div class="resp-no">—</div><div class="resp-name">No respondents recorded.</div></div>'}
      </section>

      <section class="section-block">
        <div class="section-head"><span class="section-no">02</span><span class="section-name">ADVOCATE DETAILS</span></div>
        <div class="advocate-card">
          <div class="advocate-row">
            <div class="advocate-cell"><div class="meta-label">ADVOCATE</div><div class="meta-value">${text((caseData.Adv || '').toUpperCase())}</div></div>
            <div class="advocate-cell"><div class="meta-label">MOBILE</div><div class="meta-value">${text(caseData.AdvMoNo)}</div></div>
          </div>
          <div class="advocate-row single">
            <div class="advocate-cell"><div class="meta-label">ADDRESS</div><div class="meta-value">${text(caseData.AdvAddress)}</div></div>
          </div>
        </div>
        <div class="copies-line">COPIES FOR RESPONDENT NO. <b>${text(caseData.RespndentNo)}</b></div>
      </section>

      ${caseData.Remark ? `<section class="section-block">
        <div class="section-head"><span class="section-no">03</span><span class="section-name">REMARKS</span></div>
        <div class="remarks">${text(caseData.Remark)}</div>
      </section>` : ''}

      <div class="doc-footer">
        <span>Government Pleader · Nagpur Bench</span>
        <span>Generated ${escapeDocumentText(generatedLabel)}</span>
      </div>
    </div>
  </main>
  ${autoPrint ? `<script>
    window.addEventListener('load', async function () {
      await document.fonts.ready;
      window.onafterprint = function () { window.close(); };
      window.focus();
      requestAnimationFrame(function () { window.print(); });
    });
  </script>` : ''}
</body>
</html>`
}
