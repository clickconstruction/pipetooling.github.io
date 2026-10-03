import { describe, expect, it } from 'vitest'
import { buildLegalDigestEmail } from './legalEmails'

const digest = (releasedAt: string | null, createdAt: string): string =>
  buildLegalDigestEmail({
    companyName: 'Click Plumbing and Electrical',
    recipientName: 'Bo Sample',
    matters: [{ payerName: 'Pat Payer', stage: 'with_firm', handlingName: 'Ann Sample', releasedAt }],
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
