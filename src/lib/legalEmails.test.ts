import { describe, expect, it } from 'vitest'
import { FIRM_EMAIL_MODE_WORDS, LEGAL_CONFIRM_EXPIRED_REASON, buildLegalDigestEmail, buildLegalNowEmail, buildLegalWelcomeEmail } from './legalEmails'

describe('the firm’s emails · punch list #85 item 3 · the firm’s words and the payload’s company name', () => {
  const now = (trigger: 'referred' | 'answer' | 'pulled') =>
    buildLegalNowEmail({ companyName: 'Acme Mechanical', firmName: 'Sample & Partner, PLLC', trigger, payer: 'Pat Payer', handling: 'Ann Sample', portalUrl: 'https://x.test/legal', unsubscribeUrl: 'https://x.test/stop' })

  it('the footer names the company the payload sends, never a hard-coded brand', () => {
    const html = now('referred').html
    expect(html).toContain("on the firm's email list on Acme Mechanical's legal portal")
    expect(html).not.toMatch(/Click/)
  })

  it('a referral reads as a referral, not the office’s attorney-ready release', () => {
    const mail = now('referred')
    expect(mail.html).toContain('Acme Mechanical has referred <b>Pat Payer</b> to Sample &amp; Partner, PLLC')
    expect(mail.html).not.toMatch(/attorney-ready|released it/)
  })

  it('a pull-back is a referral withdrawn', () => {
    const mail = now('pulled')
    expect(mail.subject).toBe('Referral withdrawn: Pat Payer')
    expect(mail.html).toContain('Acme Mechanical has withdrawn the referral of <b>Pat Payer</b>')
  })

  it('the digest lists stages in the firm’s words', () => {
    const html = buildLegalDigestEmail({ companyName: 'Acme Mechanical', recipientName: 'Bo', matters: [{ payerName: 'A', stage: 'referred' }, { payerName: 'B', stage: 'judgment' }], events: [{ createdAt: '2026-10-02T12:00:00Z', trigger: 'pulled', payer: 'C' }], portalUrl: 'https://x.test/legal', unsubscribeUrl: 'https://x.test/stop' }).html
    expect(html).toContain('<b>A</b> <span style="font-weight:400;color:#5a6b7e">— referred</span>')
    expect(html).toContain('<b>B</b> <span style="font-weight:400;color:#5a6b7e">— judgment entered</span>')
    // v2.6281: a matter withdrawn this week is off the open list and keeps its own heading, its lines under it.
    expect(html).toContain('<b>C</b> <span style="font-weight:400;color:#5a6b7e">— referral withdrawn</span>')
    expect(html).toContain('<li>Oct 2 · Referral withdrawn</li>')
  })
})

const digest = (releasedAt: string | null, createdAt: string): string =>
  buildLegalDigestEmail({
    companyName: 'Click Plumbing and Electrical',
    recipientName: 'Bo Sample',
    matters: [{ payerName: 'Pat Payer', stage: 'referred', handlingName: 'Ann Sample', releasedAt }],
    events: [{ createdAt, trigger: 'referred', payer: 'Pat Payer' }],
    portalUrl: 'https://x.test/legal',
    unsubscribeUrl: 'https://x.test/legal/stop',
  }).html

describe('buildLegalDigestEmail · 2026-10-02 · a matter’s and an event’s day in the company’s zone', () => {
  // 7:30 pm CDT on Oct 2 is 00:30 UTC on Oct 3: the UTC date of either is the day after.
  it('a matter released and a referral logged at 7:30 pm Central read that day', () => {
    const html = digest('2026-10-03T00:30:00Z', '2026-10-03T00:30:00+00:00')
    expect(html).toContain(' · since 2026-10-02')
    expect(html).toContain('<li>Oct 2 · New account referred</li>')
    expect(html).not.toContain('2026-10-03')
    expect(html).not.toContain('Oct 3')
  })

  it('6:30 pm in winter is still that day, and noon UTC reads its own day', () => {
    expect(digest('2026-12-02T00:30:00Z', '2026-12-02T00:30:00Z')).toContain(' · since 2026-12-01')
    expect(digest('2026-10-02T12:00:00Z', '2026-10-02T12:00:00Z')).toContain('<li>Oct 2 · New account referred</li>')
  })

  it('a matter with no release time prints no since', () => {
    expect(digest(null, '2026-10-02T12:00:00Z')).not.toContain(' · since ')
  })
})

describe('buildLegalWelcomeEmail · v2.4624 · the firm’s link, sent from the desk', () => {
  const base = { companyName: 'Click Plumbing and Electrical', companyPhone: '(512) 360-0599', firmName: 'Sample & Partner, PLLC', greetName: 'Ann Sample', portalUrl: 'https://x.test/legal?t=abc123', matterCount: 2, sender: { name: 'Will Douglas', email: 'will@x.test', phone: '(512) 555-0100' } }

  it('says who we are, carries the link, and puts adding the firm’s people first', () => {
    const m = buildLegalWelcomeEmail(base)
    expect(m.subject).toBe('Your collections portal from Click Plumbing and Electrical')
    expect(m.html).toContain('Hello Ann Sample,')
    expect(m.html).toContain('This is Will Douglas at Click Plumbing and Electrical.')
    expect(m.html).toContain('href="https://x.test/legal?t=abc123"')
    expect(m.html).toContain('Sample &amp; Partner, PLLC')
    expect(m.html).toContain('2 accounts are waiting for you there now.')
    expect(m.html.indexOf('Open the portal and choose Notifications.')).toBeLessThan(m.html.indexOf('What you will find there'))
    expect(m.replyTo).toBe('will@x.test')
    expect(m.html).not.toContain('Stop these emails')
  })

  it('has a full plain-text part, not just the subject and the link', () => {
    const t = buildLegalWelcomeEmail({ ...base, note: 'Good talking today.' }).text
    expect(t).toContain('Your portal: https://x.test/legal?t=abc123')
    expect(t).toContain('1. Open the portal and choose Notifications.')
    expect(t).toContain('2. Add each person at the firm who should hear from us.')
    expect(t).toContain('Good talking today.')
    expect(t).toContain('call us at (512) 360-0599')
    expect(t.split('\n').length).toBeGreaterThan(15)
    // The HTML's footer line rides the plain part too.
    expect(t.trimEnd().endsWith('Nothing else is emailed to this address unless someone at the firm adds it on the portal.')).toBe(true)
  })

  it('names the email rule in the Notifications control’s own words', () => {
    const t = buildLegalWelcomeEmail(base).text
    expect(t).toContain(`3. Each person sets Emails to ${FIRM_EMAIL_MODE_WORDS.now} or ${FIRM_EMAIL_MODE_WORDS.digest}`)
    expect(t).not.toMatch(/right away/)
  })

  it('greets the firm with no handling person, signs as the office with no sender, and escapes the office’s line', () => {
    const m = buildLegalWelcomeEmail({ ...base, greetName: ' ', sender: null, matterCount: 0, note: '<b>hi</b>' })
    expect(m.html).toContain('Hello Sample &amp; Partner, PLLC,')
    expect(m.html).toContain('This is the office at Click Plumbing and Electrical.')
    expect(m.html).toContain('No accounts are on it yet.')
    expect(m.html).toContain('&lt;b&gt;hi&lt;/b&gt;')
    expect(m.replyTo).toBeNull()
  })

  it('one account reads as one', () => {
    expect(buildLegalWelcomeEmail({ ...base, matterCount: 1 }).text).toContain('One account is waiting for you there now.')
  })
})

describe('the confirm page’s expired words · v2.4624', () => {
  it('point at Resend the confirmation, not at being added again', () => {
    expect(LEGAL_CONFIRM_EXPIRED_REASON).toContain('Resend the confirmation')
    expect(LEGAL_CONFIRM_EXPIRED_REASON).not.toMatch(/add you again/)
  })
})

describe('buildLegalDigestEmail · v2.6281 · the digest reads by matter', () => {
  const html = buildLegalDigestEmail({
    companyName: 'Click Plumbing and Electrical',
    recipientName: 'Dana Whitlock',
    matters: [
      { payerName: 'Saltgrass Mechanical', stage: 'payment_plan', handlingName: 'Priya Natarajan', releasedAt: '2026-08-14T18:00:00Z' },
      { payerName: 'Ridgeway Builders', stage: 'referred', handlingName: 'Dana Whitlock', releasedAt: '2026-10-26T18:00:00Z' },
      { payerName: 'Cedar Bend Homes', stage: 'demand', handlingName: 'Priya Natarajan', releasedAt: '2026-10-12T18:00:00Z' },
    ],
    events: [
      { createdAt: '2026-10-26T18:00:00Z', trigger: 'referred', payer: 'Ridgeway Builders' },
      { createdAt: '2026-10-27T18:00:00Z', trigger: 'ask', payer: 'Ridgeway Builders', body: 'Do you have the signed change order?' },
      { createdAt: '2026-10-28T18:00:00Z', trigger: 'answer', payer: 'cedar bend homes', body: 'Yes, certified mail.' },
      { createdAt: '2026-10-29T18:00:00Z', trigger: 'note', payer: 'Northline Builders', body: 'The GC called.' },
      { createdAt: '2026-10-30T18:00:00Z', trigger: 'applied', payer: 'Cedar Bend Homes', amount: 4200 },
      { createdAt: '2026-10-30T19:00:00Z', trigger: 'pulled', payer: 'Northline Builders', reason: 'paid in full' },
      { createdAt: '2026-10-30T20:00:00Z', trigger: 'fee_seen', payer: 'Ridgeway Builders', amount: 450 },
    ],
    portalUrl: 'https://x.test/legal',
    unsubscribeUrl: 'https://x.test/stop',
  }).html

  it('each matter is a heading with its stage line, and its week sits under it in order', () => {
    const at = (s: string) => html.indexOf(s)
    const ridgeway = at('<b>Ridgeway Builders</b>')
    const cedar = at('<b>Cedar Bend Homes</b>')
    const northline = at('<b>Northline Builders</b>')
    const saltgrass = at('<b>Saltgrass Mechanical</b>')
    expect([ridgeway, cedar, northline, saltgrass].every((n) => n >= 0)).toBe(true)
    // Matters with news first, newest news first (Ridgeway's fee at 20:00 outranks Cedar's payment at 18:00); the withdrawn one after them; the quiet one last.
    expect(ridgeway).toBeLessThan(cedar)
    expect(cedar).toBeLessThan(northline)
    expect(northline).toBeLessThan(saltgrass)
    expect(html).toContain('<b>Ridgeway Builders</b> <span style="font-weight:400;color:#5a6b7e">— referred · handling Dana Whitlock · since 2026-10-26</span></h3><ul style="margin:0 0 4px"><li>Oct 26 · New account referred</li><li>Oct 27 · The office asks — Do you have the signed change order?</li><li>Oct 30 · Fee seen by the office $450.00</li></ul>')
    // The payer is matched case and spaces aside, as the dispatcher writes it.
    expect(html).toContain('<li>Oct 28 · Office answered — Yes, certified mail.</li><li>Oct 30 · Payment applied $4,200.00</li>')
    expect(html).toContain('<b>Northline Builders</b> <span style="font-weight:400;color:#5a6b7e">— referral withdrawn</span></h3><ul style="margin:0 0 4px"><li>Oct 29 · Note from the office — The GC called.</li><li>Oct 30 · Referral withdrawn — paid in full</li></ul>')
    expect(html).toContain('<b>Saltgrass Mechanical</b> <span style="font-weight:400;color:#5a6b7e">— payment plan · handling Priya Natarajan · since 2026-08-14</span></h3><ul style="margin:0 0 4px"><li style="color:#5a6b7e">Nothing new this week.</li></ul>')
    expect(html).not.toContain('Open matters')
    expect(html).not.toContain('Since your last digest')
  })

  it('nothing open and nothing new says so in one line; the subject still counts the open matters', () => {
    const empty = buildLegalDigestEmail({ companyName: 'Acme Mechanical', recipientName: 'Bo', matters: [], events: [], portalUrl: 'https://x.test/legal', unsubscribeUrl: 'https://x.test/stop' })
    expect(empty.html).toContain('<p>No open matters, and nothing new this week.</p>')
    expect(empty.subject).toBe('Weekly digest — 0 open matters at Acme Mechanical')
  })
})
