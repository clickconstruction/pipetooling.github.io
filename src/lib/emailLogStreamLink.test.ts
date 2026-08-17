import { describe, expect, it } from 'vitest'
import { emailLogStreamForSubject, emailStreamCardId } from './emailLogStreamLink'

describe('emailLogStreamForSubject', () => {
  it('maps each stream template to its card key', () => {
    expect(emailLogStreamForSubject('Job activity summary — week 2026-08-09 to 2026-08-15')).toBe('digest')
    expect(emailLogStreamForSubject('Job activity summary — 2026-08-14')).toBe('digest')
    expect(emailLogStreamForSubject('Billed awaiting payment — Mon, Aug 17, 2026 — $101,969 due')).toBe('billed')
    expect(emailLogStreamForSubject('Paid in full — 633 · Adam Jarrett — $300.00')).toBe('paid')
    expect(emailLogStreamForSubject('Payment progress — 804 · Summit GC — $1,000.00 of $5,000.00 paid')).toBe('payment')
    expect(emailLogStreamForSubject('Not paid — 812 · Some Job')).toBe('payment')
    expect(emailLogStreamForSubject('Dispatch schedule — 2026-08-18 (America/Chicago)')).toBe('schedule_day')
    expect(emailLogStreamForSubject('Weekly money movement — Aug 10 – 16')).toBe('weekly_money')
    expect(emailLogStreamForSubject('Weekly movement — Aug 10 – 16 — Click Plumbing and Electrical')).toBe('weekly_movement')
    expect(emailLogStreamForSubject('Open balances — Click Plumbing and Electrical — Aug 17, 2026')).toBe('gc_statement')
    expect(emailLogStreamForSubject('Open balances (all GCs) — Click Plumbing and Electrical — Aug 17, 2026')).toBe('gc_statement')
  })

  it('strips the [TEST] prefix from test sends', () => {
    expect(emailLogStreamForSubject('[TEST] Billed awaiting payment — Mon, Aug 17, 2026 — $500 due')).toBe('billed')
  })

  it('returns null for non-stream subjects', () => {
    expect(emailLogStreamForSubject('Quote #10 accepted — Michael Palmer')).toBeNull()
    expect(emailLogStreamForSubject('Click Plumbing and Electrical Estimate: Estimate #12')).toBeNull()
    expect(emailLogStreamForSubject(null)).toBeNull()
    expect(emailLogStreamForSubject('')).toBeNull()
    // "Weekly money movement" must not be eaten by the "Weekly movement" pattern and vice versa.
    expect(emailLogStreamForSubject('Weekly movement — Aug 10 – 16 — Click Plumbing and Electrical')).not.toBe('weekly_money')
  })

  it('builds stable card ids', () => {
    expect(emailStreamCardId('paid')).toBe('email-stream-paid')
  })
})
