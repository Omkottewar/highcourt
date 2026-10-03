import interFont from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'
import { buildCaseDocument } from './caseDocument'

export function printCase(caseData) {
  if (!caseData) return
  const win = window.open('', '_blank', 'width=960,height=1000,scrollbars=yes')
  if (!win) { alert('Please allow popups for this site to print or save a PDF.'); return }
  const html = buildCaseDocument(caseData, {
    fontURL: new URL(interFont, document.baseURI).href,
    autoPrint: true,
  })
  win.document.write(html)
  win.document.close()
}
