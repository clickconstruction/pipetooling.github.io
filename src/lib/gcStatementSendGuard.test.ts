import { describe, expect, it } from 'vitest'
import { GC_STATEMENT_NOTHING_OWED_COPY, dollarsToCents, gcStatementSendGuard } from './gcStatementSendGuard'

describe('gcStatementSendGuard (journey-map #46 / J20-F4)', () => {
  const ok = { totalOwedCents: 45_000, emailSending: false, hasAddress: true }

  it('lets a real balance with a real address send', () => {
    expect(gcStatementSendGuard(ok)).toEqual({ canSend: true, blockedBy: null, message: null })
  })

  it('blocks Send now on $0 with the dispatcher\'s own skip, in office words', () => {
    const g = gcStatementSendGuard({ ...ok, totalOwedCents: 0 })
    expect(g.canSend).toBe(false)
    expect(g.blockedBy).toBe('nothing_owed')
    expect(g.message).toBe(GC_STATEMENT_NOTHING_OWED_COPY)
    expect(GC_STATEMENT_NOTHING_OWED_COPY).toBe('Nothing owed — no statement goes out.')
  })

  it('a negative or NaN total is also nothing owed', () => {
    expect(gcStatementSendGuard({ ...ok, totalOwedCents: -1200 }).blockedBy).toBe('nothing_owed')
    expect(gcStatementSendGuard({ ...ok, totalOwedCents: Number.NaN }).blockedBy).toBe('nothing_owed')
  })

  it('$0 wins over a missing address — the group is the problem, not the To field', () => {
    expect(gcStatementSendGuard({ ...ok, totalOwedCents: 0, hasAddress: false }).blockedBy).toBe('nothing_owed')
  })

  it('a send in flight blocks silently', () => {
    expect(gcStatementSendGuard({ ...ok, emailSending: true })).toEqual({ canSend: false, blockedBy: 'sending', message: null })
  })

  it('no address blocks without a message (the To field already shows the gap)', () => {
    expect(gcStatementSendGuard({ ...ok, hasAddress: false })).toEqual({ canSend: false, blockedBy: 'no_address', message: null })
  })

  it('Schedule… may still be set up at $0 — the dispatcher rebuilds fresh and skips empties itself', () => {
    expect(gcStatementSendGuard({ ...ok, totalOwedCents: 0, scheduled: true }).canSend).toBe(true)
    expect(gcStatementSendGuard({ ...ok, totalOwedCents: 0, scheduled: true, hasAddress: false }).blockedBy).toBe('no_address')
  })

  it('dollarsToCents rounds the rollup subtotal', () => {
    expect(dollarsToCents(450)).toBe(45_000)
    expect(dollarsToCents(0.005)).toBe(1)
    expect(dollarsToCents(Number.NaN)).toBe(0)
  })
})
