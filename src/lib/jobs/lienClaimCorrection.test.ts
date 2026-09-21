import { describe, expect, it } from 'vitest'
import { claimDeltaWords, claimSplit, claimSplitWords, correctedClaim, correctionGateWords, correctionNeedsLook, correctionSendGate, correctionSetWords, type LienClaimCorrection } from './lienClaimCorrection'

const c = (over: Partial<LienClaimCorrection> = {}): LienClaimCorrection => ({ jobId: 'j258', amountOff: 1500, perMonth: null, reason: 'GC disputes the 8/14 change order ($1,500); claim the agreed portion', carry: true, setByName: 'Taunya', setAt: '2026-09-21T15:00:00Z', lookedAt: null, lookedByName: '', ...over })

describe('correctedClaim (v2.3682)', () => {
  it('is an amount off the moving balance, never a snapshot', () => {
    expect(correctedClaim(9_800, null)).toEqual({ claim: 9_800, delta: 0, over: false, corrected: false })
    expect(correctedClaim(9_800, c())).toEqual({ claim: 8_300, delta: -1_500, over: false, corrected: true })
    expect(correctedClaim(11_300, c())).toEqual({ claim: 9_800, delta: -1_500, over: false, corrected: true })
    expect(correctedClaim(9_800, c({ amountOff: -1_400 }))).toEqual({ claim: 11_200, delta: 1_400, over: true, corrected: true })
    expect(correctedClaim(500, c({ amountOff: 1_500 })).claim).toBe(0)
  })

  it('says the difference in the office’s words', () => {
    expect(claimDeltaWords(-1_500, 9_800)).toBe('$1,500 under the $9,800 unpaid in the app')
    expect(claimDeltaWords(1_400, 9_800)).toBe('$1,400 more than the app says is unpaid')
    expect(claimDeltaWords(0, 9_800)).toBe('')
  })

  it('prints a split only where a person gave a month its own figure; one blank month takes the rest', () => {
    expect(claimSplit(['2026-07', '2026-08'], 5_900, null)).toBeNull()
    expect(claimSplit(['2026-07', '2026-08'], 5_900, { '2026-07': 0 })).toEqual([{ month: '2026-07', amount: 0 }, { month: '2026-08', amount: 5_900 }])
    expect(claimSplitWords(claimSplit(['2026-07', '2026-08'], 5_900, { '2026-07': 0 }))).toBe('Jul 2026 $0.00 · Aug 2026 $5,900.00')
    // two blank months: the rest would be a formula — no split on the paper
    expect(claimSplit(['2026-06', '2026-07', '2026-08'], 5_900, { '2026-06': 100 })).toBeNull()
    expect(claimSplit(['2026-07'], 5_900, { '2026-08': 1 })).toBeNull()
  })

  it('the line under the figure, and the gate on the send', () => {
    expect(correctionSetWords(c(), (d) => d)).toBe('Taunya · 2026-09-21 · “GC disputes the 8/14 change order ($1,500); claim the agreed portion”')
    // Not carried, or nothing sent since: nothing to look at.
    expect(correctionNeedsLook(c(), null)).toBe(false)
    expect(correctionNeedsLook(c({ carry: false }), '2026-09-24T10:00:00Z')).toBe(false)
    expect(correctionNeedsLook(c(), '2026-09-24T10:00:00Z')).toBe(true)
    expect(correctionNeedsLook(c({ lookedAt: '2026-10-30T10:00:00Z' }), '2026-09-24T10:00:00Z')).toBe(false)
    expect(correctionSendGate(null, 9_800, null)).toBeNull()
    expect(correctionSendGate(c(), 9_800, null)).toBeNull()
    expect(correctionSendGate(c(), 9_800, '2026-09-24T10:00:00Z')).toBe('look')
    expect(correctionSendGate(c({ amountOff: -1_400 }), 9_800, null)).toBe('leader')
    expect(correctionGateWords('leader')).toContain('the leader approves it knowingly')
    expect(correctionGateWords('look')).toContain('still true')
  })
})
