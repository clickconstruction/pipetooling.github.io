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
})
