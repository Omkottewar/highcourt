import { format } from 'date-fns'
import { splitRespondents } from './respondents'

function fmtDate(dateStr) {
  if (!dateStr || dateStr === '1900-01-01') return 'Unknown'
  try { return format(new Date(dateStr), 'dd MMMM yyyy') } catch { return '—' }
}

function escape(str) {
  return String(str ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
}

export function printCase(caseData) {
  if (!caseData) return

  const respondents = splitRespondents(caseData.Respondets)
  const caseYear  = (!caseData.CYear || caseData.CYear === '0') ? 'Unknown' : caseData.CYear
  const district  = caseData.District || '—'
  const longType  = caseData.LongType || ''
  const typeText  = caseData.Type || '—'
  const dated     = fmtDate(caseData.Dated)
  const advName   = caseData.Adv || ''
  const advMobile = caseData.AdvMoNo || ''
  const copyNos   = caseData.RespndentNo || ''

  const respRows = respondents.map((name, i) => `
    <tr>
      <td class="resp-num">${i + 1}.</td>
      <td class="resp-name">${escape(name)}</td>
    </tr>`).join('')

  const advBlock = advName ? `
    <div class="adv-block">
      <div class="adv-label">Adv.</div>
      <div class="adv-name">${escape(advName)}</div>
      ${advMobile ? `<div class="adv-mobile">${escape(advMobile)}</div>` : ''}
      <div class="adv-role">Counsel for the Petitioner</div>
    </div>` : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Case ${escape(caseData.RegdNo)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    @page { size: A4; margin: 0; }

    body {
      font-family: 'EB Garamond', 'Garamond', 'Times New Roman', Times, serif;
      font-size: 12pt;
      color: #111;
      background: #fff;
      -webkit-font-smoothing: antialiased;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 22mm 22mm 22mm 26mm;
      margin: 0 auto;
      position: relative;
      background: #fff;
    }

    /* ── Registration markers ────────────────────────── */
    .regd-circle {
      position: absolute;
      top: 14mm;
      width: 17mm; height: 17mm;
      border: 0.6pt solid #111;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 11pt; font-weight: 600;
      letter-spacing: 0.02em;
      font-family: 'Inter', 'Helvetica', sans-serif;
    }
    .regd-circle.left  { left: 12mm; }
    .regd-circle.right { right: 12mm; }

    /* ── Masthead ────────────────────────────────────── */
    .masthead {
      text-align: center;
      margin: 6mm 0 8mm;
    }
    .masthead-eyebrow {
      font-family: 'Inter', sans-serif;
      font-size: 8.5pt;
      letter-spacing: 0.32em;
      text-transform: uppercase;
      color: #6b6b6b;
      margin-bottom: 5mm;
    }
    .masthead-title {
      font-size: 18pt;
      font-weight: 500;
      letter-spacing: -0.005em;
      line-height: 1.25;
      color: #111;
    }
    .masthead-sub {
      font-size: 11pt;
      font-style: italic;
      color: #4a4a4a;
      margin-top: 1.5mm;
      letter-spacing: 0.01em;
    }
    .masthead-rule {
      width: 28mm;
      height: 0.6pt;
      background: #b8893d;
      margin: 5mm auto 0;
    }

    /* ── Long-type / WP line ─────────────────────────── */
    .wp-line {
      text-align: center;
      font-size: 16pt;
      font-weight: 500;
      letter-spacing: 0.04em;
      margin: 8mm 0 6mm;
      font-family: 'Inter', 'Helvetica', sans-serif;
    }

    .hairline {
      border: none;
      border-top: 0.4pt solid #c8c8c8;
      margin: 5mm 0;
    }

    /* ── Meta grid ───────────────────────────────────── */
    .meta {
      display: grid;
      grid-template-columns: 22mm 1fr 22mm 22mm 1fr;
      row-gap: 2.4mm;
      column-gap: 4mm;
      font-size: 11.5pt;
      margin: 4mm 0 6mm;
      line-height: 1.55;
    }
    .meta .k {
      font-family: 'Inter', sans-serif;
      font-size: 8.5pt;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #777;
      align-self: center;
    }
    .meta .v {
      font-weight: 500;
      color: #111;
    }
    .meta .gap { }

    .copy-line {
      font-size: 11pt;
      margin: 3mm 0 7mm;
      padding: 3mm 4mm;
      background: #f7f0e1;
      border-left: 1.5pt solid #b8893d;
      font-family: 'Inter', sans-serif;
      letter-spacing: 0.005em;
    }
    .copy-line .k {
      font-size: 8.5pt;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #6b5024;
      margin-right: 4mm;
    }

    /* ── Parties ─────────────────────────────────────── */
    .parties {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 12mm;
      margin: 6mm 0 4mm;
    }
    .petitioner-block {
      flex: 1;
      font-size: 12pt;
      line-height: 1.55;
    }
    .party-label {
      font-family: 'Inter', sans-serif;
      font-size: 8.5pt;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #777;
      margin-bottom: 1.5mm;
    }
    .party-name {
      font-weight: 500;
      color: #111;
      letter-spacing: 0.005em;
    }

    .adv-block {
      text-align: right;
      font-size: 11pt;
      line-height: 1.65;
      min-width: 60mm;
    }
    .adv-label {
      font-family: 'Inter', sans-serif;
      font-size: 8.5pt;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #777;
      margin-bottom: 1mm;
    }
    .adv-name { font-weight: 600; font-size: 11.5pt; color: #111; }
    .adv-mobile {
      font-family: 'Inter', sans-serif;
      font-size: 10pt;
      color: #4a4a4a;
      letter-spacing: 0.01em;
    }
    .adv-role { font-style: italic; color: #6b6b6b; font-size: 10pt; margin-top: 0.5mm; }

    /* ── V/s ─────────────────────────────────────────── */
    .vs-line {
      text-align: center;
      font-size: 12pt;
      font-weight: 500;
      font-style: italic;
      color: #4a4a4a;
      letter-spacing: 0.08em;
      margin: 7mm 0 5mm;
      position: relative;
    }
    .vs-line::before, .vs-line::after {
      content: '';
      display: inline-block;
      width: 24mm; height: 0.4pt;
      background: #c8c8c8;
      vertical-align: middle;
      margin: 0 6mm;
    }

    /* ── Respondents ─────────────────────────────────── */
    .resp-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11.5pt;
      line-height: 1.55;
    }
    .resp-table td {
      padding: 1.8mm 0;
      vertical-align: top;
      border-bottom: 0.3pt solid #ececec;
    }
    .resp-table tr:last-child td { border-bottom: none; }
    .resp-num {
      width: 10mm;
      font-family: 'Inter', sans-serif;
      font-size: 10pt;
      color: #b8893d;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .resp-name { color: #111; }

    /* ── Footer ──────────────────────────────────────── */
    .footer {
      position: absolute;
      bottom: 14mm; left: 26mm; right: 22mm;
      padding-top: 4mm;
      border-top: 0.3pt solid #d8d8d8;
      display: flex; justify-content: space-between;
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #888;
    }

    @media print {
      body { margin: 0; }
      .page { margin: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="regd-circle left">${escape(caseData.RegdNo)}</div>
    <div class="regd-circle right">${escape(caseData.RegdNo)}</div>

    <div class="masthead">
      <div class="masthead-eyebrow">Office of the Government Pleader</div>
      <div class="masthead-title">High Court of Bombay</div>
      <div class="masthead-sub">Bench at Nagpur</div>
      <div class="masthead-rule"></div>
    </div>

    <div class="wp-line">${escape(longType || typeText)}</div>

    <hr class="hairline">

    <div class="meta">
      <span class="k">Regd. No.</span>
      <span class="v">${escape(caseData.RegdNo)}</span>
      <span class="gap"></span>
      <span class="k">District</span>
      <span class="v">${escape(district)}</span>

      <span class="k">Dated</span>
      <span class="v">${escape(dated)}</span>
      <span class="gap"></span>
      <span class="k">Type</span>
      <span class="v">${escape(typeText)}</span>
    </div>

    ${copyNos ? `<div class="copy-line"><span class="k">Copy received for Resp. No.</span>${escape(copyNos)}</div>` : ''}

    <div class="parties">
      <div class="petitioner-block">
        <div class="party-label">Petitioner</div>
        <div class="party-name">${escape(caseData.Petitioner || '—')}</div>
      </div>
      ${advBlock}
    </div>

    <div class="vs-line">V e r s u s</div>

    ${respondents.length > 0 ? `
      <div class="party-label" style="margin-bottom: 3mm">Respondents</div>
      <table class="resp-table">${respRows}</table>
    ` : ''}

    <div class="footer">
      <span>Office of the Government Pleader</span>
      <span>Bench at Nagpur</span>
    </div>
  </div>

  <script>
    window.onload = function () {
      window.focus();
      window.print();
      window.onafterprint = function () { window.close(); };
    };
  </script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=900,scrollbars=yes')
  if (!win) { alert('Please allow popups for this site to enable printing.'); return }
  win.document.write(html)
  win.document.close()
}
