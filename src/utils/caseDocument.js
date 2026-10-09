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
  const safeFontURL = String(fontURL).replace(/["\\<>\r\n]/g, character => encodeURIComponent(character))
  const generatedLabel = format(new Date(generatedAt), 'dd MMM yyyy')
  const caseNumberDisplay = caseData.CaseNumber ? escapeDocumentText(caseData.CaseNumber) : '______'
  const caseYearSuffix = caseData.CaseNumber && year ? escapeDocumentText(year) : '20____'
  const regdNo = text(caseData.RegdNo)
  const petitioner = text((caseData.Petitioner || '').toUpperCase())

  const respCount = respondents.length
  const respChars = respondents.reduce((a, n) => a + n.length, 0)
  const petChars = (caseData.Petitioner || '').length
  const remarkLines = caseData.Remark ? Math.ceil(String(caseData.Remark).length / 80) : 0
  let densityTier = 'd1'
  if (respCount > 8 || respChars > 360 || petChars > 90 || remarkLines > 4) densityTier = 'd2'
  if (respCount > 16 || respChars > 820 || petChars > 160 || remarkLines > 8) densityTier = 'd3'
  if (respCount > 28 || respChars > 1500) densityTier = 'd4'
  if (respCount > 48 || respChars > 2600) densityTier = 'd5'

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
    }
    * { box-sizing: border-box; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; background: #fff; color: #000; font-family: Georgia, 'Times New Roman', serif; font-size: 10.5pt; line-height: 1.4; }
    .document { width: 210mm; height: 297mm; padding: 10mm 14mm 10mm; display: flex; flex-direction: column; overflow: hidden; }

    .header-strip { display: grid; grid-template-columns: 1fr 2.1fr 1fr; column-gap: 4mm; margin-bottom: 4mm; flex: 0 0 auto; }
    .strip-cell { text-align: center; padding: 2mm 3mm; border: 1pt solid #000; background: #fff; }
    .strip-label { font-family: 'Case Inter', Arial, sans-serif; font-size: 6.5pt; letter-spacing: 2.5pt; color: #000; margin-bottom: 1mm; }
    .strip-value { font-family: 'Case Inter', Arial, sans-serif; font-size: 11pt; font-weight: 700; letter-spacing: .6pt; color: #000; font-variant-numeric: tabular-nums; }
    .strip-value b { font-weight: 700; }

    .seal-row { text-align: center; margin: 0 0 2mm; font-family: 'Case Inter', Arial, sans-serif; font-size: 7.5pt; letter-spacing: 3pt; color: #000; flex: 0 0 auto; }
    .office-title { text-align: center; font-weight: 700; font-size: 13.5pt; margin: 0; line-height: 1.25; flex: 0 0 auto; }
    .office-sub { text-align: center; font-style: italic; font-size: 10pt; color: #000; margin: 0 0 2mm; flex: 0 0 auto; }
    .rule-dbl { border: none; border-top: 1pt solid #000; border-bottom: .5pt solid #000; height: 1.5mm; margin: 0 0 4mm; flex: 0 0 auto; }

    .particulars { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; border: 1pt solid #000; margin-bottom: 4mm; flex: 0 0 auto; }
    .particulars > div { padding: 2mm 3.5mm; border-right: 1pt solid #000; }
    .particulars > div:last-child { border-right: none; }
    .particulars .lbl { font-family: 'Case Inter', Arial, sans-serif; font-size: 6.5pt; letter-spacing: 1.8pt; color: #000; margin-bottom: 1mm; }
    .particulars .val { font-size: 10.5pt; font-weight: 700; color: #000; overflow-wrap: anywhere; line-height: 1.25; }

    .party-block { margin-bottom: 2mm; flex: 0 0 auto; }
    .party-tag { display: inline-block; font-family: 'Case Inter', Arial, sans-serif; font-size: 7.5pt; letter-spacing: 3pt; color: #000; border-bottom: .5pt solid #000; padding-bottom: .8mm; margin-bottom: 2mm; }
    .party-tag .sub { font-style: italic; font-family: Georgia, 'Times New Roman', serif; letter-spacing: 0; font-size: 8.5pt; margin-left: 2mm; color: #333; }

    .petitioner-name { font-size: 12pt; font-weight: 700; line-height: 1.35; padding: 1mm 0 1mm 8mm; text-indent: -5mm; overflow-wrap: anywhere; }
    .petitioner-name::before { content: '1.'; display: inline-block; width: 5mm; font-variant-numeric: tabular-nums; }

    .versus { text-align: center; margin: 2.5mm 0; font-size: 11.5pt; font-style: italic; font-weight: 700; letter-spacing: 4pt; position: relative; flex: 0 0 auto; }
    .versus::before, .versus::after { content: ''; position: absolute; top: 50%; width: 42%; height: 0; border-top: .5pt solid #000; }
    .versus::before { left: 0; }
    .versus::after { right: 0; }

    .resp-wrap { flex: 1 1 auto; min-height: 0; overflow: hidden; }
    .resp-list { margin: 0; padding: 0; list-style: none; column-gap: 6mm; }
    .resp-item { display: grid; grid-template-columns: 7mm 1fr; column-gap: 1.5mm; padding: 1.4mm 0; border-bottom: .3pt solid #999; font-size: 10.5pt; line-height: 1.3; overflow-wrap: anywhere; break-inside: avoid; }
    .resp-item:last-child { border-bottom: none; }
    .resp-num { font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
    .resp-empty { padding: 2mm 0; font-style: italic; color: #555; }

    .advocate-block { margin-top: 4mm; border: 1pt solid #000; padding: 2mm 3.5mm 1.5mm; flex: 0 0 auto; }
    .advocate-tag { font-family: 'Case Inter', Arial, sans-serif; font-size: 7.5pt; letter-spacing: 3pt; color: #000; margin-bottom: 1.5mm; }
    .advocate-row { display: grid; grid-template-columns: 1fr 44mm; gap: 5mm; align-items: baseline; }
    .advocate-row .k { font-family: 'Case Inter', Arial, sans-serif; font-size: 6.5pt; letter-spacing: 1.8pt; color: #000; }
    .advocate-row .v { font-size: 11pt; font-weight: 700; color: #000; overflow-wrap: anywhere; line-height: 1.25; }
    .advocate-row .v.mobile { font-variant-numeric: tabular-nums; letter-spacing: .4pt; }
    .copies-line { margin-top: 2mm; font-family: 'Case Inter', Arial, sans-serif; font-size: 7.5pt; letter-spacing: 1.8pt; color: #000; display: flex; justify-content: space-between; }
    .copies-line b { font-family: Georgia, 'Times New Roman', serif; font-weight: 700; margin-left: 2mm; letter-spacing: 0; font-size: 10.5pt; }

    .remarks-block { margin-top: 3mm; border: 1pt solid #000; padding: 2mm 3.5mm 2.5mm; flex: 0 0 auto; max-height: 30mm; overflow: hidden; }
    .remarks-tag { font-family: 'Case Inter', Arial, sans-serif; font-size: 7.5pt; letter-spacing: 3pt; color: #000; margin-bottom: 1.5mm; }
    .remarks-text { font-size: 10pt; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; color: #000; }

    .signature-row { margin-top: auto; padding-top: 10mm; display: grid; grid-template-columns: 1fr 1fr; gap: 20mm; flex: 0 0 auto; }
    .signature-row .sig { text-align: center; }
    .signature-row .sig .line { border-top: .5pt solid #000; padding-top: 1.5mm; font-family: 'Case Inter', Arial, sans-serif; font-size: 7.5pt; letter-spacing: 2pt; }

    .doc-footer { margin-top: 3mm; padding-top: 1.5mm; border-top: .5pt solid #000; display: flex; justify-content: space-between; font-family: 'Case Inter', Arial, sans-serif; font-size: 7pt; color: #000; letter-spacing: .4pt; flex: 0 0 auto; }

    /* Density tiers — tighten everything as party lists grow so the sheet still fits one A4 page */
    .d2 .resp-list { columns: 2; }
    .d2 .resp-item { font-size: 10pt; padding: 1.2mm 0; }
    .d2 .petitioner-name { font-size: 11.5pt; }

    .d3 { font-size: 10pt; }
    .d3 .resp-list { columns: 2; column-gap: 5mm; }
    .d3 .resp-item { font-size: 9.5pt; padding: .9mm 0; line-height: 1.25; }
    .d3 .petitioner-name { font-size: 11pt; padding: .5mm 0 .5mm 8mm; }
    .d3 .versus { margin: 1.5mm 0; font-size: 11pt; }
    .d3 .signature-row { padding-top: 6mm; }

    .d4 { font-size: 9.5pt; }
    .d4 .resp-list { columns: 3; column-gap: 4mm; }
    .d4 .resp-item { font-size: 8.5pt; padding: .6mm 0; line-height: 1.2; grid-template-columns: 6mm 1fr; }
    .d4 .petitioner-name { font-size: 10.5pt; padding: .3mm 0 .3mm 7mm; text-indent: -4mm; }
    .d4 .petitioner-name::before { width: 4mm; }
    .d4 .versus { margin: 1mm 0; font-size: 10.5pt; }
    .d4 .party-block { margin-bottom: 1mm; }
    .d4 .signature-row { padding-top: 4mm; }
    .d4 .advocate-block { margin-top: 2.5mm; padding: 1.5mm 3mm 1.2mm; }

    .d5 { font-size: 9pt; }
    .d5 .header-strip { margin-bottom: 2.5mm; }
    .d5 .strip-cell { padding: 1.5mm 2.5mm; }
    .d5 .strip-value { font-size: 10pt; }
    .d5 .office-title { font-size: 12.5pt; }
    .d5 .office-sub { font-size: 9pt; margin-bottom: 1mm; }
    .d5 .rule-dbl { margin-bottom: 2mm; }
    .d5 .particulars { margin-bottom: 2.5mm; }
    .d5 .particulars > div { padding: 1.5mm 3mm; }
    .d5 .particulars .val { font-size: 10pt; }
    .d5 .resp-list { columns: 3; column-gap: 3.5mm; }
    .d5 .resp-item { font-size: 7.8pt; padding: .35mm 0; line-height: 1.15; grid-template-columns: 5mm 1fr; }
    .d5 .petitioner-name { font-size: 10pt; padding: .2mm 0 .2mm 6mm; text-indent: -3.5mm; }
    .d5 .petitioner-name::before { width: 3.5mm; }
    .d5 .versus { margin: .5mm 0; font-size: 10pt; }
    .d5 .party-block { margin-bottom: .5mm; }
    .d5 .signature-row { padding-top: 2.5mm; }
    .d5 .signature-row .sig .line { padding-top: 1mm; font-size: 7pt; }
    .d5 .advocate-block { margin-top: 2mm; padding: 1.2mm 3mm 1mm; }
    .d5 .advocate-row .v { font-size: 10pt; }
    .d5 .remarks-block { max-height: 20mm; margin-top: 2mm; padding: 1.5mm 3mm 2mm; }
    .d5 .remarks-text { font-size: 8.5pt; line-height: 1.3; }
    .d5 .doc-footer { margin-top: 1.5mm; font-size: 6.5pt; }

    @media screen {
      body { background: #e8e8e2; padding: 8mm 0; }
      .document { margin: 0 auto; background: white; box-shadow: 0 3mm 12mm #0003; }
    }
    @media print { .document { margin: 0; } }
  </style>
</head>
<body>
  <main class="document ${densityTier}">
    <header class="header-strip">
      <div class="strip-cell">
        <div class="strip-label">REGD NO.</div>
        <div class="strip-value">${regdNo}</div>
      </div>
      <div class="strip-cell">
        <div class="strip-label">CASE REFERENCE</div>
        <div class="strip-value"><b>${escapeDocumentText(titleCode || '____')}</b> NO. ${caseNumberDisplay}/${caseYearSuffix}</div>
      </div>
      <div class="strip-cell">
        <div class="strip-label">REGD NO.</div>
        <div class="strip-value">${regdNo}</div>
      </div>
    </header>

    <div class="seal-row">GOVERNMENT OF MAHARASHTRA</div>
    <h1 class="office-title">Office of the Government Pleader</h1>
    <p class="office-sub">High Court of Bombay, Bench at Nagpur</p>
    <hr class="rule-dbl">

    <div class="particulars">
      <div><div class="lbl">DISTRICT</div><div class="val">${text((caseData.District || '').toUpperCase())}</div></div>
      <div><div class="lbl">DATE FILED</div><div class="val">${text(filingDateLabel(caseData.Dated))}</div></div>
      <div><div class="lbl">COPIES RECEIVED</div><div class="val">${text(caseData.Copies)}</div></div>
    </div>

    <section class="party-block">
      <div><span class="party-tag">PETITIONER<span class="sub">(applicant)</span></span></div>
      <div class="petitioner-name">${petitioner}</div>
    </section>

    <div class="versus">versus</div>

    <section class="party-block">
      <div><span class="party-tag">RESPONDENT(S)<span class="sub">(opposite party)</span></span></div>
      <div class="resp-wrap">
      ${respondents.length
        ? `<ul class="resp-list">${respondents.map((name, index) =>
            `<li class="resp-item"><span class="resp-num">${escapeDocumentText(String(respondentNos[index] || index + 1).padStart(2, '0'))}.</span><span>${escapeDocumentText(name.toUpperCase())}</span></li>`
          ).join('')}</ul>`
        : '<div class="resp-empty">No respondents recorded.</div>'}
      </div>
    </section>

    <section class="advocate-block">
      <div class="advocate-tag">ADVOCATE ON RECORD</div>
      <div class="advocate-row">
        <div><div class="k">NAME</div><div class="v">${text((caseData.Adv || '').toUpperCase())}</div></div>
        <div><div class="k">MOBILE</div><div class="v mobile">${text(caseData.AdvMoNo)}</div></div>
      </div>
      <div class="copies-line"><span>COPIES FOR RESPONDENT NO.<b>${text(caseData.RespndentNo)}</b></span></div>
    </section>

    ${caseData.Remark ? `<section class="remarks-block">
      <div class="remarks-tag">REMARKS</div>
      <div class="remarks-text">${text(caseData.Remark)}</div>
    </section>` : ''}

    <div class="signature-row">
      <div class="sig"><div class="line">CLERK / DEALING ASSISTANT</div></div>
      <div class="sig"><div class="line">GOVERNMENT PLEADER</div></div>
    </div>

    <div class="doc-footer">
      <span>Office of the Government Pleader · High Court of Bombay, Nagpur Bench</span>
      <span>Generated ${escapeDocumentText(generatedLabel)}</span>
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
