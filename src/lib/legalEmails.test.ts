import { describe, expect, it } from 'vitest'
import { buildLegalDigestEmail, buildLegalNowEmail } from './legalEmails'

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
    expect(html).toContain('<b>A</b> — referred')
    expect(html).toContain('<b>B</b> — judgment entered')
    expect(html).toContain('Referral withdrawn: <b>C</b>')
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
    expect(html).toContain('<li>2026-10-02 · New account referred')
    expect(html).not.toContain('2026-10-03')
  })

  it('6:30 pm in winter is still that day, and noon UTC reads its own day', () => {
    expect(digest('2026-12-02T00:30:00Z', '2026-12-02T00:30:00Z')).toContain(' · since 2026-12-01')
    expect(digest('2026-10-02T12:00:00Z', '2026-10-02T12:00:00Z')).toContain('<li>2026-10-02 · New account referred')
  })

  it('a matter with no release time prints no since', () => {
    expect(digest(null, '2026-10-02T12:00:00Z')).not.toContain(' · since ')
  })
})
