import { describe, expect, it } from 'vitest'
import { moneyWaitingEmailSubject, moneyWaitingEmailText, renderMoneyWaitingEmail } from '../../supabase/functions/_shared/moneyWaitingEmail'
import { sampleMoneyWaitingPayload } from './teamSampleEmails'

const p = sampleMoneyWaitingPayload('2026-09-29')

describe('moneyWaitingEmail (the digest’s renderer, lifted v2.4161)', () => {
  it('subject counts the off-pace customers and the dollars', () => {
    expect(moneyWaitingEmailSubject(p)).toBe('Money waiting — 3 customers off pace, $51,220 open')
    expect(moneyWaitingEmailSubject({ ...p, rows: [] })).toBe('Money waiting — everyone is on pace')
    expect(moneyWaitingEmailSubject({ ...p, pay_speeds: null })).toBe('Money waiting — everyone is on pace')
  })
  it('text lists the customers slowest first with every bill under them', () => {
    const t = moneyWaitingEmailText(p)
    const lines = t.split('\n')
    expect(lines[0]).toBe('Money waiting — slowest first')
    expect(t.indexOf('Sam Sample')).toBeLessThan(t.indexOf('Sample Contracting'))
    expect(t).toContain('  - Water heater replacement · 100 Sample St, Kyle, TX 78640 — $4,380, waiting 58d')
    expect(t).toContain('On pace: 1 customer · $5,724 open')
  })
  it('html deep-links every job at the app origin it is given and carries the sender', () => {
    const html = renderMoneyWaitingEmail(p, 'https://clicktooling.com', 'Wendi')
    expect(html).toContain('href="https://clicktooling.com/jobs?jobDetail=job-3"')
    expect(html).toContain('href="https://clicktooling.com/jobs?tab=stages&amp;forecast=1"')
    expect(html).toContain('Sent by Wendi')
    expect(html).toContain('58d waiting')
    expect(renderMoneyWaitingEmail({ ...p, pay_speeds: null }, 'https://x')).toContain('Pay-speed data was unavailable')
  })
  it('a bill an in kind deal pays is under no customer, and one line says so (punch list #301)', () => {
    // job-3 is Sam Sample's one bill, 58 days waiting. On a deal nobody chases it.
    const stamped = { ...p, rows: p.rows.map((r) => (r.job_id === 'job-3' ? { ...r, in_kind_arrangement_id: 'deal-a' } : r)) }
    expect(moneyWaitingEmailSubject(stamped)).toBe('Money waiting — 2 customers off pace, $46,840 open')
    const t = moneyWaitingEmailText(stamped)
    expect(t).not.toContain('Sam Sample')
    expect(t.split('\n').pop()).toBe('$4,380 on 1 bill is scheduled in kind, not money waiting.')
    const html = renderMoneyWaitingEmail(stamped, 'https://clicktooling.com')
    expect(html).not.toContain('jobDetail=job-3')
    expect(html).toContain('$4,380 on 1 bill is scheduled in kind, not money waiting.')
    expect(renderMoneyWaitingEmail(p, 'https://x')).not.toContain('scheduled in kind')
    expect(moneyWaitingEmailText(p)).not.toContain('scheduled in kind')
  })
})
