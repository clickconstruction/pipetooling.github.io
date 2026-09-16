import { describe, expect, it } from 'vitest'
import { CUSTOMER_SAMPLE_SETTING_KEYS, buildSampleBidRoomEmail, buildSampleContractEmail, buildSampleEmail, buildSampleEstimateEmail, type SampleEmailContext } from './customerSampleEmails'
import { SAMPLE_GC, SAMPLE_HOMEOWNER } from './customerSample'

const ctx: SampleEmailContext = {
  rows: [
    { key: 'estimate_email_body_template', value_text: 'Hello from Settings.\n\n{{accept_url}}\n\nBye from Settings.' },
    { key: 'estimate_accept_page_footer', value_text: 'Click Plumbing and Electrical\nRMP M-00000' },
    { key: 'bid_cover_letter_terms_default_v1', value_text: 'Good for forty-five (45) days.' },
  ],
  origin: 'https://clicktooling.com',
  todayYmd: '2026-09-04',
  dateLabel: 'Sep 4, 2026',
  sender: { name: 'Wendi Douglas', email: 'wendi@clickplumbing.com', phone: '(512) 555-0142' },
}

describe('sample emails (What customers see)', () => {
  it('the estimate email is the real builder over the live Settings rows', () => {
    const m = buildSampleEstimateEmail(ctx)
    expect(m.subject).toBe('Estimate #0 — Water heater replacement — $4,380 · Click Plumbing')
    expect(m.html).toContain('Hello from Settings.')
    expect(m.html).toContain('Bye from Settings.')
    expect(m.html).toContain('RMP M-00000')
    expect(m.html).toContain('href="https://clicktooling.com/estimate/accept?t=sample"')
    expect(m.html).toContain('Pricing is good through Sep 18, 2026.')
    expect(m.html).toContain(SAMPLE_HOMEOWNER.address)
    expect(m.replyTo).toBe('wendi@clickplumbing.com')
  })
  it('the bid room email reads the cover-letter terms default for its validity line', () => {
    const m = buildSampleBidRoomEmail(ctx, false)
    expect(m.subject).toBe('Plumbing proposal — Cedar Bend Apartments — $56,343 · Click Plumbing')
    expect(m.html).toContain('Pricing is good for 45 days.')
    expect(m.html).toContain('bid-room?t=sample')
    expect(m.text).toContain('To Plans (our recommendation)')
    const r = buildSampleBidRoomEmail(ctx, true)
    expect(r.subject).toContain('Revised')
    expect(r.html).toContain('What changed in revision 2:')
  })
  it('the contract email is the send function\'s builder over the sample agreement, sub and viewer', () => {
    const m = buildSampleContractEmail(ctx)
    expect(m.subject).toBe('Please sign: Subcontractor agreement (sample) · Click Plumbing and Electrical')
    expect(m.html).toContain('For Sam Plumber')
    expect(m.html).toContain('Sent to you by Wendi Douglas')
    expect(m.html).toContain('href="https://clicktooling.com/contract/accept?t=sample"')
    expect(m.html).toContain('works until Sep 18, 2026')
    expect(m.html).toContain('my.clickplumbing.com/sams-plumbing keeps your jobs')
    expect(m.replyTo).toBe('wendi@clickplumbing.com')
    expect(buildSampleEmail('contract', { ...ctx, sender: null }).html).toContain('Sent to you by Click Plumbing and Electrical')
  })
  it('falls back to the fixture text when a setting is blank', () => {
    const m = buildSampleBidRoomEmail({ ...ctx, rows: [] }, false)
    expect(m.html).toContain('Pricing is good for 30 days.')
    expect(buildSampleEmail('estimate', { ...ctx, rows: [] }).html).toContain('Please review and accept your estimate.')
  })
  it('one settings fetch covers every surface', () => {
    expect(CUSTOMER_SAMPLE_SETTING_KEYS).toContain('estimate_email_body_template')
    expect(CUSTOMER_SAMPLE_SETTING_KEYS).toContain('estimate_public_terms_body')
    expect(CUSTOMER_SAMPLE_SETTING_KEYS).toContain('bid_cover_letter_exclusions_default_v1')
    expect(SAMPLE_GC.company).toBe('Sample Contracting')
  })
  it('the job-contract emails (v2.3510) come from the senders\' builder over the sample job, with the signing link', () => {
    const ctx = { rows: [], origin: 'https://x.test', todayYmd: '2026-09-16', dateLabel: 'Sep 16, 2026', sender: { name: 'Taunya', email: 't@x.test', phone: '' } }
    const send = buildSampleEmail('job-contract', ctx)
    expect(send.subject).toBe('Please sign: Service agreement for 100 Sample St, Kyle, TX 78640 — Job #1042')
    expect(send.html).toContain('https://x.test/contract/sign?t=sample')
    expect(send.text).toContain('Contract amount: $1,850.00')
    expect(send.text).toContain('— Taunya')
    const rem = buildSampleEmail('job-contract-reminder', ctx)
    expect(rem.subject).toContain('Reminder: please sign')
    expect(rem.html).toContain('https://x.test/contract/sign?t=sample')
  })
  it('the GC emails (v2.3511): the pricing package and the statement build from their real builders; the test report waits for Settings', () => {
    const ctx = { rows: [], origin: 'https://x.test', todayYmd: '2026-09-16', dateLabel: 'Sep 16, 2026', sender: { name: 'Taunya', email: 't@x.test', phone: '' } }
    const pkg = buildSampleEmail('pricing-package', ctx)
    expect(pkg.subject).toBe('Pricing — BP482 Cedar Bend Apartments')
    expect(pkg.html).toContain('Water closet, wall-hung')
    expect(pkg.html).toContain('Sent by Taunya')
    expect(pkg.text).toContain('Bid: BP482 Cedar Bend Apartments')
    const st = buildSampleEmail('gc-statement', ctx)
    expect(st.subject).toContain('open balances: Sep 16, 2026')
    expect(st.html).toContain('Statement for Sample Contracting')
    expect(st.html).toContain('my.clickplumbing.com/sample-contracting')
    expect(st.text).toContain('4400 Sample Pkwy')
    const waiting = buildSampleEmail('test-report', ctx)
    expect(waiting.html).toContain('Loading the test-report settings')
    const withSettings = buildSampleEmail('test-report', { ...ctx, testReportSettings: { companyName: 'Click Plumbing', officePhone: '(512) 555-0100', emailBodyTemplate: 'Attached is the {report} for {address}. {payLink}', certifierName: '', certifierLicense: '', autoSendPass: false } as never })
    expect(withSettings.subject.startsWith('[Sample] ')).toBe(true)
    expect(withSettings.html).toContain('invoice.stripe.com/i/sample/test-report')
  })
  it('the supply house and the law firm (v2.3512): five emails from their real builders over the sample', () => {
    const ctx = { rows: [], origin: 'https://x.test', todayYmd: '2026-09-16', dateLabel: 'Sep 16, 2026', sender: { name: 'Taunya', email: 't@x.test', phone: '' } }
    const rfq = buildSampleEmail('rfq-request', ctx)
    expect(rfq.subject).toBe('Price request · BP482 · Cedar Bend Apartments · 5 items · needed by Mon, 9/21')
    expect(rfq.html).toContain('https://x.test/q/sample')
    expect(rfq.text).toContain('Sample Supply Co.')
    const acct = buildSampleEmail('job-account', ctx)
    expect(acct.subject.length).toBeGreaterThan(5)
    expect(acct.html).toContain('Sample Owner LLC')
    expect(acct.html).toContain(SAMPLE_GC.company)
    const confirm = buildSampleEmail('legal-confirm', ctx)
    expect(confirm.subject).toBe("Confirm your email for Click Plumbing and Electrical's legal portal")
    expect(confirm.html).toContain('https://x.test/legal/confirm?t=sample')
    const now = buildSampleEmail('legal-now', ctx)
    expect(now.subject).toBe(`New account referred: ${SAMPLE_HOMEOWNER.name}`)
    expect(now.html).toContain('handling: Ann Sample')
    expect(now.html).toContain('https://x.test/legal?t=sample')
    expect(now.html).toContain('https://x.test/legal/confirm?t=sample&stop=1')
    const digest = buildSampleEmail('legal-digest', ctx)
    expect(digest.subject).toBe('Weekly digest — 1 open matter at Click Plumbing and Electrical')
    expect(digest.html).toContain('Your weekly digest, Bo Sample.')
    expect(digest.html).toContain('New account referred')
  })
})
