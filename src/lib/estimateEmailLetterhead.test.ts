import { describe, expect, it } from 'vitest'
import {
  buildEstimateLetterheadEmail,
  estimateEmailCompanyName,
  formatYmdForEmail,
  splitBodyTemplateParagraphs,
  type EstimateLetterheadInput,
} from './estimateEmailLetterhead'

const LIVE_TEMPLATE =
  'Our team wants to be there for you. Please review and accept your estimate if you would like us to move forward with the following link:\n\n' +
  'https://clicktooling.com/estimate/accept?t=abc123\n\n' +
  "If you have any questions please don't hesitate to reach out.\nPhone: 512-360-0599\nEmail: office@clickplumbing.com\n\n" +
  'Protecting our neighbors since 2014,\nThank you from the Click Plumbing and Electrical Team'

const base: EstimateLetterheadInput = {
  docKind: 'estimate',
  estimateNumber: 482,
  title: 'Water heater <replacement>',
  totalCents: 438_000,
  validUntilYmd: '2026-09-18',
  forAddress: '1408 Cedar Bend, Kyle TX',
  acceptUrl: 'https://clicktooling.com/estimate/accept?t=abc123',
  brand: 'plum',
  brandImageUrl: 'https://clicktooling.com/brand/click-plum.png',
  bodyText: LIVE_TEMPLATE,
  options: [],
  footerLines: ['Click Plumbing and Electrical', '12925 FM 20, Kingsbury, TX 78638', '', 'Malachi Whites RMP M-41130'],
  sender: { name: 'Wendi Douglas', email: 'wendi@clickplumbing.com' },
  dateLabel: 'Sep 4, 2026',
}

describe('buildEstimateLetterheadEmail (v2.2743 letterhead)', () => {
  it('subject files well: kind, number, title, whole-dollar total, company', () => {
    expect(buildEstimateLetterheadEmail(base).subject).toBe('Estimate #482 — Water heater <replacement> — $4,380 · Click Plumbing')
    expect(buildEstimateLetterheadEmail({ ...base, title: '  ', brand: null }).subject).toBe('Estimate #482 — $4,380 · Click Plumbing and Electrical')
  })
  it('the owner template splits: first paragraph opens, link paragraph is dropped, the rest sign off', () => {
    const { intro, closing } = splitBodyTemplateParagraphs(LIVE_TEMPLATE, base.acceptUrl)
    expect(intro).toMatch(/^Our team wants to be there/)
    expect(closing).toHaveLength(2)
    expect(closing.join('\n')).not.toContain('accept?t=')
    const { html, text } = buildEstimateLetterheadEmail(base)
    expect(html).toContain('Our team wants to be there for you.')
    expect(html).toContain('Phone: 512-360-0599<br />Email: office@clickplumbing.com')
    expect(text).toContain('Protecting our neighbors since 2014,')
    // The link appears exactly where the button and its fallback put it, not as a loose paragraph.
    expect((text.match(/accept\?t=abc123/g) ?? []).length).toBe(1)
  })
  it('a leftover {{accept_url}} placeholder never reaches the customer', () => {
    const { text, html } = buildEstimateLetterheadEmail({ ...base, bodyText: 'Hello.\n\n{{accept_url}}\n\nBye.' })
    expect(text).not.toContain('{{accept_url}}')
    expect(html).not.toContain('{{accept_url}}')
  })
  it('a stored copy that holds a different accept link (rows sent before v2.2747) drops that paragraph too', () => {
    const { closing } = splitBodyTemplateParagraphs('Hello.\n\nhttps://clicktooling.com/estimate/accept?t=older\n\nBye.', 'https://example.com/estimate/accept?t=preview')
    expect(closing).toEqual(['Bye.'])
  })
  it('the link is a real link: bgcolor button cell plus a plain-URL fallback', () => {
    const { html } = buildEstimateLetterheadEmail(base)
    expect(html).toContain('<td bgcolor="#ea580c"')
    expect(html).toContain(`<a href="${base.acceptUrl}"`)
    expect(html).toContain('Review &amp; accept the estimate')
    expect(html).toContain('Can&rsquo;t click the button?')
    expect(html).toContain('color-scheme" content="light only"')
    expect(html).not.toContain('display:flex')
  })
  it('heading, meta line, total box and validity come from the row', () => {
    const { html, text } = buildEstimateLetterheadEmail(base)
    expect(html).toContain('Water heater &lt;replacement&gt;</h1>')
    expect(html).toContain('Estimate #482 &middot; 1408 Cedar Bend, Kyle TX &middot; Sep 4, 2026')
    expect(html).toContain('Estimate total')
    expect(html).toContain('$4,380.00')
    expect(html).toContain('Pricing is good through Sep 18, 2026.')
    expect(text).toContain('Estimate total: $4,380.00')
    const bare = buildEstimateLetterheadEmail({ ...base, validUntilYmd: null, forAddress: '  ' })
    expect(bare.html).not.toContain('Pricing is good through')
    expect(bare.html).toContain('Estimate #482 &middot; Sep 4, 2026')
  })
  it('two or more options replace the total box with the ladder, recommendation first-class', () => {
    const m = buildEstimateLetterheadEmail({
      ...base,
      options: [
        { name: 'Repair', recommended: false, totalCents: 90_000 },
        { name: 'Replace', recommended: true, totalCents: 438_000 },
      ],
    })
    expect(m.subject).toContain('$4,380')
    expect(m.html).toContain('<strong>Replace</strong>')
    expect(m.html).toContain('Our recommendation')
    expect(m.html).toContain('>Alternate<')
    expect(m.html).not.toContain('Estimate total')
    expect(m.text).toContain('* Replace (our recommendation): $4,380.00')
    const one = buildEstimateLetterheadEmail({ ...base, options: [{ name: 'Only', recommended: true, totalCents: 1 }] })
    expect(one.html).toContain('Estimate total')
  })
  it('change orders swap the wording', () => {
    const m = buildEstimateLetterheadEmail({ ...base, docKind: 'change_order', title: '' })
    expect(m.subject).toBe('Change order #482 — $4,380 · Click Plumbing')
    expect(m.html).toContain('Your change order</h1>')
    expect(m.html).toContain('Net change to contract')
    expect(m.html).toContain('Review &amp; sign the change order')
  })
  it('sender sets Reply-To and the footer reach line; no sender, no either', () => {
    const m = buildEstimateLetterheadEmail(base)
    expect(m.replyTo).toBe('wendi@clickplumbing.com')
    expect(m.html).toContain('Reply to this email to reach Wendi Douglas.')
    expect(m.html).toContain('12925 FM 20, Kingsbury, TX 78638 &middot; Malachi Whites RMP M-41130')
    const anon = buildEstimateLetterheadEmail({ ...base, sender: null, footerLines: [] })
    expect(anon.replyTo).toBeNull()
    expect(anon.html).not.toContain('Reply to this email')
  })
  it('banner only when a brand image is given; escapes everything customer-typed', () => {
    expect(buildEstimateLetterheadEmail({ ...base, brandImageUrl: null }).html).not.toContain('<img')
    expect(buildEstimateLetterheadEmail(base).html).toContain('<img src="https://clicktooling.com/brand/click-plum.png"')
    const m = buildEstimateLetterheadEmail({ ...base, bodyText: 'Hi <b>there</b> & "you"' })
    expect(m.html).toContain('Hi &lt;b&gt;there&lt;/b&gt; &amp; &quot;you&quot;')
  })
  it('helpers', () => {
    expect(estimateEmailCompanyName('elec')).toBe('Click Electrical')
    expect(formatYmdForEmail('2026-01-05')).toBe('Jan 5, 2026')
    expect(formatYmdForEmail('2026-13-05')).toBeNull()
    expect(formatYmdForEmail(null)).toBeNull()
  })
})
