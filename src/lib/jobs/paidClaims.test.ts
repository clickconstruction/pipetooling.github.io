import { describe, expect, it } from 'vitest'
import { claimFitsDeposit, claimStale, claimSuggestionWords, daysSinceClaim, myStaleClaims, parsePaidClaimsRpc, staleClaimLine, staleClaims, staleWords, type PaidClaim } from './paidClaims'

const raw = (over: Record<string, unknown> = {}) => ({
  id: 'w1', jobId: 'j1', jobNumber: '1032', jobName: 'Whitfield repipe', jobStatus: 'billed', bidId: 'b512', customerId: 'c1', customerName: 'Dana Whitfield', payerCustomerId: 'c1',
  paidYmd: '2026-10-20', method: 'check_mailed', amount: null, saidBy: 'Dana', heardById: 'u-theo', heardByName: 'Theo', channel: 'text', note: 'Check #1187', createdAt: '2026-10-21T14:40:00Z',
  landedSince: 0, landedOn: null, ...over,
})
const claim = (over: Record<string, unknown> = {}): PaidClaim => parsePaidClaimsRpc([raw(over)])![0]!

describe('parsePaidClaimsRpc', () => {
  it('reads a row, defaults the rest, drops what is not a claim', () => {
    const rows = parsePaidClaimsRpc([raw({ amount: '1500', landedSince: '3200.00', landedOn: '2026-10-24' }), raw({ id: 'w2', method: 'cash', amount: 0, heardByName: ' ' }), { id: 'x' }, null])!
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ amount: 1500, landedSince: 3200, landedOn: '2026-10-24', method: 'check_mailed', heardByName: 'Theo' })
    expect(rows[1]).toMatchObject({ method: null, amount: null, heardByName: null, landedSince: 0, landedOn: null })
    expect(parsePaidClaimsRpc(null)).toBeNull()
  })
})

describe('stale', () => {
  it('days since the day they named, stale at seven with nothing landed, never once something landed', () => {
    expect(daysSinceClaim(claim(), '2026-10-29')).toBe(9)
    expect(claimStale(claim(), '2026-10-26')).toBe(false)
    expect(claimStale(claim(), '2026-10-27')).toBe(true)
    expect(claimStale(claim({ landedSince: 1 }), '2026-11-30')).toBe(false)
    expect(staleWords(claim(), '2026-10-29')).toBe('nothing landed in 9 days')
    expect(staleWords(claim(), '2026-10-21')).toBe('nothing landed in 1 day')
  })
  it('the stale ones, oldest first, and mine by who heard them', () => {
    const all = [claim({ id: 'a', paidYmd: '2026-10-22' }), claim({ id: 'b', paidYmd: '2026-10-10', heardById: 'u-rosa' }), claim({ id: 'c', paidYmd: '2026-10-01', landedSince: 500 })]
    expect(staleClaims(all, '2026-10-30').map((c) => c.id)).toEqual(['b', 'a'])
    expect(myStaleClaims(all, 'u-theo', '2026-10-30').map((c) => c.id)).toEqual(['a'])
    expect(myStaleClaims(all, null, '2026-10-30')).toEqual([])
  })
  it('the line', () => {
    expect(staleClaimLine(claim(), '2026-10-29')).toBe('J1032 Whitfield repipe · Dana said a check went out Oct 20 · nothing landed in 9 days')
    expect(staleClaimLine(claim({ method: 'paid_online', saidBy: null, jobNumber: '' }), '2026-10-29')).toBe('Whitfield repipe · Dana Whitfield said they paid Oct 20 · paid online · nothing landed in 9 days')
  })
})

describe('the deposit a claim fits', () => {
  it('the claim’s amount, or the job’s open money, within a dollar, on or after the day', () => {
    expect(claimFitsDeposit(claim(), { amount: 4200, ymd: '2026-10-22', counterparty: 'WHITFIELD D' }, 4200)).toEqual({ fits: true, nameToo: true })
    expect(claimFitsDeposit(claim({ amount: 1500 }), { amount: 1500.4, ymd: '2026-10-22', counterparty: 'MOBILE DEPOSIT' }, 4200)).toEqual({ fits: true, nameToo: false })
    expect(claimFitsDeposit(claim(), { amount: 4200, ymd: '2026-10-19', counterparty: null }, 4200).fits).toBe(false)
    expect(claimFitsDeposit(claim(), { amount: 4000, ymd: null, counterparty: null }, 4200).fits).toBe(false)
    expect(claimFitsDeposit(claim({ landedSince: 4200 }), { amount: 4200, ymd: '2026-10-22', counterparty: null }, 0).fits).toBe(false)
    expect(claimFitsDeposit(claim(), { amount: 4200, ymd: null, counterparty: null }, null).fits).toBe(false)
  })
  it('the suggestion’s words', () => {
    expect(claimSuggestionWords(claim())).toBe('Theo wrote Oct 21: Dana says they paid, a check in the mail Oct 20 · “Check #1187”')
    expect(claimSuggestionWords(claim({ heardByName: null, saidBy: null, customerName: null, note: null, method: null }))).toBe('They say they paid, not sure how Oct 20')
  })
})
