import { buildCaseDocument } from './caseDocument'

const sample = {
  RegdNo: 12345, CYear: '2025', Petitioner: 'Sample Petitioner', Respondets: 'First respondent.,Second respondent.',
  Title: 'WP', Type: 'WP', LongType: 'Writ Petition', District: 'Nagpur', Dated: '2025-04-03',
  Adv: 'Sample Advocate', AdvMoNo: '0123456789', Copies: '3', RespndentNo: '1, 2', Remark: 'First line\nSecond line',
  UpdatedAt: '2026-09-26T08:30:00Z',
}
const options = { generatedAt: '2026-09-26T12:00:00Z' }

test('the professional case record includes every recorded case field', () => {
  const html = buildCaseDocument(sample, options)
  for (const value of ['12345', 'SAMPLE PETITIONER', 'FIRST RESPONDENT', 'SECOND RESPONDENT', 'WRIT PETITION',
    'NAGPUR', '03 April 2025', 'SAMPLE ADVOCATE', '0123456789', '1, 2', 'First line\nSecond line']) expect(html).toContain(value)
  expect(html).toContain('<b>WP</b>')
  expect(html).toContain('CASE REFERENCE')
  expect(html).toContain('______')
  expect(html).toContain('versus')
  expect(html).toContain('Office of the Government Pleader')
  expect(html).toContain('Bench at Nagpur')
  expect(html).toContain('Case record')
  expect(html).toContain('PARTIES TO THE CASE')
  expect(html).toContain('ADVOCATE DETAILS')
  expect(html).toContain('REMARKS')
  expect(html).toContain('Generated 26 Sep 2026')
})

test('court-assigned case number is composed into the printed line with case year', () => {
  const html = buildCaseDocument({ ...sample, CaseNumber: '7373' }, options)
  expect(html).toContain('7373/2025')
  expect(html).not.toContain('______/20_____')
})

test('missing dates and respondents are safely handled', () => {
  const html = buildCaseDocument({ RegdNo: 1, CYear: '0', Dated: '1900-01-01' }, options)
  expect(html).not.toContain('1900-01-01')
  expect(html).toContain('No respondents recorded.')
  expect(html).not.toContain('undefined')
})

test('case text cannot inject markup, scripts, or style tags into a print window', () => {
  const html = buildCaseDocument({ ...sample, Petitioner: '<script>alert(1)</script>', Remark: '</style><img src=x onerror=alert(1)>' }, options)
  expect(html).not.toContain('<script>a')
  expect(html).not.toContain('<img')
  expect(html).toContain('&lt;SCRIPT&gt;ALERT(1)&lt;/SCRIPT&gt;')
  expect(html).toContain('&lt;/style&gt;')
})

test('long respondent lists are retained and the print flow waits for fonts', () => {
  const html = buildCaseDocument({ ...sample, Respondets: Array.from({ length: 40 }, (_, i) => `Respondent ${i + 1}`).join('.,') }, { ...options, autoPrint: true })
  expect(html.match(/class="resp-name"/g)).toHaveLength(40)
  expect(html).toContain('await document.fonts.ready')
  expect(html.indexOf('window.onafterprint')).toBeLessThan(html.indexOf('window.print()'))
})

test('title controls the blank line and respondent numbers come from the stored list', () => {
  const html = buildCaseDocument({ ...sample, Title: 'ACB', RespondentNumbers: '["3","7"]' }, options)
  expect(html).toContain('<b>ACB</b>')
  expect(html).not.toContain('<b>WP</b>')
  expect(html).toContain('class="resp-no">03</div>')
  expect(html).toContain('class="resp-no">07</div>')
})
