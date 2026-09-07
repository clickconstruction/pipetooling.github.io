import { describe, expect, it } from 'vitest'
import { BID_OUTCOME_DERIVED_TOAST_MS, bidOutcomeDerivedMessage, normalizeBidOutcome, shouldAnnounceDerivedOutcome } from './bidOutcomeFromJob'

describe('shouldAnnounceDerivedOutcome', () => {
  it('announces only a real move to Started or complete', () => {
    expect(shouldAnnounceDerivedOutcome(null, 'started_or_complete')).toBe(true)
    expect(shouldAnnounceDerivedOutcome('won', 'started_or_complete')).toBe(true)
    expect(shouldAnnounceDerivedOutcome('lost', 'started_or_complete')).toBe(true)
    expect(shouldAnnounceDerivedOutcome('started_or_complete', 'started_or_complete')).toBe(false)
    expect(shouldAnnounceDerivedOutcome('won', 'won')).toBe(false) // the trigger did not run (a twin session, a refused write)
    expect(shouldAnnounceDerivedOutcome(undefined, null)).toBe(false)
  })
})

describe('bidOutcomeDerivedMessage', () => {
  it('names the bid, the new outcome, what it was, and why', () => {
    expect(bidOutcomeDerivedMessage({ bidNumber: '1842', projectName: 'Riverside', before: 'won' })).toBe('Bid #1842 · Riverside is now Started or complete (was Won) — it has a job.')
    expect(bidOutcomeDerivedMessage({ bidNumber: '1842', projectName: null, before: null })).toBe('Bid #1842 is now Started or complete (was undecided) — it has a job.')
    expect(bidOutcomeDerivedMessage({ bidNumber: ' ', projectName: 'Riverside', before: 'lost' })).toBe('Bid Riverside is now Started or complete (was Lost) — it has a job.')
    expect(bidOutcomeDerivedMessage({ bidNumber: null, projectName: null, before: 'bogus' })).toBe('The linked bid is now Started or complete (was undecided) — it has a job.')
  })
  it('lingers five seconds; unknown outcomes read as undecided', () => {
    expect(BID_OUTCOME_DERIVED_TOAST_MS).toBe(5000)
    expect(normalizeBidOutcome('pending')).toBeNull()
  })
})
