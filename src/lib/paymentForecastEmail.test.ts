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
  it('a bill an in kind deal pays is in no week, and the last line says so (punch list #301)', () => {
    // job-3: $4,380, 46 days late on pay history. On a deal it is a credit to come, not cash.
    const stamped = { ...p, rows: p.rows.map((r) => (r.job_id === 'job-3' ? { ...r, in_kind_arrangement_id: 'deal-a' } : r)) }
    expect(paymentForecastEmailSubject(stamped)).toBe('Payment forecast — Tue, Sep 29, 2026 — $38,640 past expected · $8,200 this week')
    const t = paymentForecastEmailText(stamped, 'https://clicktooling.com')
    expect(t.split('\n')[1]).toBe('4 open bills · $52,564 total')
    expect(t).not.toContain('Water heater replacement')
    expect(t.split('\n').pop()).toBe('$4,380 on 1 bill is scheduled in kind, not money coming.')
    const html = renderPaymentForecastEmail(stamped, 'https://clicktooling.com')
    expect(html).not.toContain('jobDetail=job-3')
    expect(html).toContain('&middot; $4,380 on 1 bill is scheduled in kind, not money coming')
    expect(renderPaymentForecastEmail(p, 'https://x')).not.toContain('scheduled in kind')
  })
  it('a board with only bills paid in kind does not read as empty', () => {
    const only = { ...p, rows: p.rows.filter((r) => r.job_id === 'job-3').map((r) => ({ ...r, in_kind_arrangement_id: 'deal-a' })) }
    expect(paymentForecastEmailSubject(only)).toBe('Payment forecast — Tue, Sep 29, 2026 — no bill waiting on money')
    expect(paymentForecastEmailText(only, 'https://x')).toBe('Payment forecast — Tue, Sep 29, 2026\nNo bill is waiting on money. $4,380 on 1 bill is scheduled in kind, not money coming.')
    const html = renderPaymentForecastEmail(only, 'https://x')
    expect(html).toContain('No bill is waiting on money.')
    expect(html).not.toContain('Nothing open on the board')
    expect(html).toContain('$4,380 on 1 bill is scheduled in kind, not money coming')
  })
})
