// Generates PDF previews using the same case-document template as the app.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const babel = require('@babel/core')
const root = path.join(__dirname, '..')
const out = path.join(root, '.cache/pdf-preview')
fs.mkdirSync(out, { recursive: true })
app.setPath('userData', fs.mkdtempSync(path.join(root, '.cache/pdf-review-')))
app.disableHardwareAcceleration()
app.on('window-all-closed', () => {})
const original = require.extensions['.js']
require.extensions['.js'] = (module, filename) => {
  if (!filename.startsWith(path.join(root, 'src') + path.sep)) return original(module, filename)
  module._compile(babel.transformSync(fs.readFileSync(filename, 'utf8'), { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] }).code, filename)
}
const { buildCaseDocument } = require('../src/utils/caseDocument')
const sample = {
  RegdNo: 20260482, CYear: '2026', Type: 'Writ Petition', Title: 'WP', LongType: 'WRIT PETITION NO. 1842 / 2026',
  Dated: '2026-09-18', District: 'Nagpur', Copies: '3', RespndentNo: '1, 2',
  Petitioner: 'ANANYA SUDHIR DESHMUKH',
  Respondets: 'THE STATE OF MAHARASHTRA, through its Secretary, Department of Revenue, Mantralaya, Mumbai.,THE DISTRICT COLLECTOR, Nagpur District, Civil Lines, Nagpur',
  Adv: 'ADV. S. R. KULKARNI', AdvMoNo: '0000000000', AdvAddress: 'Sample Chamber 12, High Court Road, Civil Lines, Nagpur',
  Remark: 'Layout preview — fictional sample data.\nDocuments received for office scrutiny. Three copies placed on file.',
}
const long = { ...sample, RegdNo: 20260483, Petitioner: 'SAMPLE PETITIONER — MULTIPAGE LAYOUT TEST',
  Respondets: Array.from({ length: 32 }, (_, i) => `Respondent ${String(i + 1).padStart(2, '0')} — Sample public office ${i + 1}, through the designated officer, Administrative Building, Civil Lines, Nagpur, Maharashtra 440001`).join('.,'),
  Remark: 'MULTIPAGE TEST: all 32 respondents must appear, followed by advocate details and these remarks.\n' + 'Sample note for document layout verification. '.repeat(60) + '\nEND OF RECORD — layout verification complete.',
}
const minimal = { RegdNo: 100, CYear: '0', Dated: '1900-01-01', Petitioner: 'SAMPLE RECORD WITH UNAVAILABLE DETAILS', Copies: 0 }
app.whenReady().then(async () => {
  try {
    const fontURL = pathToFileURL(path.join(root, 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')).href
    for (const [name, data] of [['case-record-sample', sample], ['case-record-multipage', long], ['case-record-minimal', minimal]]) {
      const html = buildCaseDocument(data, { fontURL, generatedAt: '2026-09-26T12:00:00Z' })
      const htmlPath = path.join(out, name + '.html')
      fs.writeFileSync(htmlPath, html)
      const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false } })
      win.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_, callback) => callback({ cancel: true }))
      await win.loadFile(htmlPath)
      await win.webContents.executeJavaScript(`document.fonts.ready.then(() => { if (!document.fonts.check('12px "Case Inter"')) throw new Error('Print font failed to load') })`)
      const pdf = await win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false, generateTaggedPDF: true })
      fs.writeFileSync(path.join(out, name + '.pdf'), pdf)
      console.log(name + '.pdf: ' + pdf.length + ' bytes')
      win.destroy()
    }
    app.exit(0)
  } catch (error) { console.error(error); app.exit(1) }
})
