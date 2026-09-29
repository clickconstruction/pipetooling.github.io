import { describe, expect, it } from 'vitest'
import { paymentForecastEmailSubject, paymentForecastEmailText, renderPaymentForecastEmail } from '../../supabase/functions/_shared/paymentForecastEmail'
import { sampleForecastPayload } from './teamSampleEmails'

const p = sampleForecastPayload('2026-09-29')

describe('paymentForecastEmail (the digest’s renderer, lifted v2.4164)', () => {
  it('subject names the past-expected and this-week buckets', () => {
    expect(paymentForecastEmailSubject(p)).toBe('Payment forecast — Tue, Sep 29, 2026 — $43,020 past expected · $8,200 this week')
    expect(paymentForecastEmailSubject({ ...p, rows: [] })).toBe('Payment forecast — Tue, Sep 29, 2026 — nothing open')
  })
  it('text lists the buckets, past expected first, every bill linked at the given origin', () => {
    const t = paymentForecastEmailText(p, 'https://clicktooling.com')
    const lines = t.split('\n')
    expect(lines[1]).toBe('5 open bills · $56,944 total')
    expect(lines[3]).toBe('Past expected · $43,020 · 3 bills · follow up')
    expect(t).toContain('  1054 · Water heater replacement · Sam Sample · 46d late · $4,380 · https://clicktooling.com/jobs?jobDetail=job-3')
    expect(t).toContain('  1046 · Cedar Bend Apartments — top out · Sample Contracting · ~Oct 2 · $8,200 · https://clicktooling.com/jobs?jobDetail=job-2')
    expect(paymentForecastEmailText({ ...p, rows: [] }, 'https://x')).toBe('Payment forecast — Tue, Sep 29, 2026\nNothing open on the board.')
  })
  it('html marks the promise, the follow-up bucket, the deep links and the sender', () => {
    const html = renderPaymentForecastEmail(p, 'https://clicktooling.com', 'Wendi')
    expect(html).toContain('promised · Wendi')
    expect(html).toContain('follow up')
    expect(html).toContain('href="https://clicktooling.com/jobs?jobDetail=job-1"')
    expect(html).toContain('href="https://clicktooling.com/jobs?tab=stages&amp;forecast=1"')
    expect(html).toContain('Sent by Wendi from ClickTooling')
    expect(renderPaymentForecastEmail({ ...p, rows: [] }, 'https://x')).toContain('Nothing open on the board. Nice.')
  })
})
